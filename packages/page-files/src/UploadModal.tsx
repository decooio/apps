// Copyright 2017-2021 @polkadot/app-files authors & contributors
// SPDX-License-Identifier: Apache-2.0

import React, {useCallback, useEffect, useMemo, useState} from "react";
import {Available, Button, Dropdown, InputAddress, Label, Modal, Password} from "@polkadot/react-components";
import {useTranslation} from './translate'
import {useAccounts} from "@polkadot/react-hooks";
import {keyring} from "@polkadot/ui-keyring";
import {web3FromSource} from "@polkadot/extension-dapp";
import {isFunction, stringToHex, stringToU8a, u8aToHex} from "@polkadot/util";
import axios, {CancelTokenSource} from 'axios';
import {createAuthIpfsEndpoints} from "@polkadot/apps-config";
import type {Signer} from "@polkadot/api/types";
import {SaveFile, UploadRes} from "./types";
import Progress from './Progress';

export interface Props {
  file: File,
  onClose?: () => void,
  onSuccess?: (res: SaveFile) => void,
}

interface AccountState {
  isExternal: boolean;
  isHardware: boolean;
  isInjected: boolean;
}

interface SignerState {
  isUsable: boolean;
  signer: Signer | null;
}

const NOOP = () => {
}

function UploadModal(p: Props) {
  const {file, onClose = NOOP, onSuccess = NOOP} = p
  const {t} = useTranslation()
  const endpoints = useMemo(
    () => createAuthIpfsEndpoints(t)
      .sort(() => Math.random() > 0.5 ? -1 : 1)
      .map(item => ({...item, text: `${item.text}(${item.location})`})),
    [t]
  );
  const [currentEndpoint, setCurrentEndpoint] = useState(endpoints[0]);
  const pinEndpoints = useMemo(() => [
    {
      text: 'Crust Pinner',
      value: 'http://pinning-service.decoo-cloud.cn'
    }
  ], [t])
  const [currentPinEndpoint, setCurrentPinEndpoint] = useState(pinEndpoints[0])
  const {hasAccounts} = useAccounts();
  const [currentPair, setCurrentPair] = useState(() => keyring.getPairs()[0] || null);
  const [account, setAccount] = useState('');
  const [{isInjected}, setAccountState] = useState<AccountState>({
    isExternal: false,
    isHardware: false,
    isInjected: false
  });
  const [isLocked, setIsLocked] = useState(false);
  const [{isUsable, signer}, setSigner] = useState<SignerState>({isUsable: true, signer: null});
  const [password, setPassword] = useState('');
  const [isBusy, setBusy] = useState(false);
  const fileSizeError = file.size > 100 * 1024 * 1024;
  const [error, setError] = useState('');
  const errorText = fileSizeError ? t('fileSizeError') : error;
  const [upState, setUpState] = useState({up: false, progress: 0});
  const [cancelUp, setCancelUp] = useState<CancelTokenSource | null>(null);
  const onAccountChange = (nAccount: string | null) => {
    if (nAccount) {
      setAccount(nAccount);
      setCurrentPair(keyring.getPair(nAccount));
    }
  };

  useEffect(() => {
    const meta = (currentPair && currentPair.meta) || {};
    const isExternal = (meta.isExternal as boolean) || false;
    const isHardware = (meta.isHardware as boolean) || false;
    const isInjected = (meta.isInjected as boolean) || false;
    const isUsable = !(isExternal || isHardware || isInjected);
    setAccountState({isExternal, isHardware, isInjected});
    setIsLocked(
      isInjected
        ? false
        : (currentPair && currentPair.isLocked) || false
    );
    console.info('meta::', isInjected, meta.source)
    setSigner({isUsable, signer: null});
    // for injected, retrieve the signer
    if (meta.source && isInjected) {
      web3FromSource(meta.source as string)
        .catch(() => null)
        .then((injected) => setSigner({
          isUsable: isFunction(injected?.signer?.signRaw),
          signer: injected?.signer || null
        }))
        .catch(console.error);
    }
  }, [currentPair]);

  const unLock = () => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          currentPair.decodePkcs8(password);
          resolve(1)
        } catch (error) {
          reject(error);
        }
      }, 0);
    });
  };

  const _onClose = useCallback(() => {
    if (cancelUp) cancelUp.cancel();
    onClose()
  }, [cancelUp])

  const _onClickUp = async () => {
    setError('');
    if (!isUsable || !currentPair) {
      return;
    }
    try {
      // 1: sign
      setBusy(true);
      if (isLocked) {
        await unLock();
      }
      let signature = '';
      if (signer && isFunction(signer.signRaw)) {
        const res = await signer.signRaw({
          address: currentPair.address,
          data: stringToHex(currentPair.address),
          type: 'bytes'
        });
        signature = res.signature;
      } else {
        signature = u8aToHex(currentPair.sign(stringToU8a(currentPair.address)));
      }
      const perSignData = `${currentPair.address}:${signature}`;
      const base64Signature = Buffer.from(perSignData).toString('base64');
      const AuthBasic = `Basic ${base64Signature}`;
      // 2: up file
      const cancel = axios.CancelToken.source();
      setCancelUp(cancel);
      setUpState({progress: 0, up: true});
      const form = new FormData();
      form.append('file', file, file.name);
      const UpEndpoint = currentEndpoint.value;
      const upResult = await axios.request<UploadRes>({
        method: 'POST',
        url: `${UpEndpoint}/api/v0/add`,
        params: {pin: true},
        headers: {Authorization: AuthBasic},
        data: form,
        cancelToken: cancel.token,
        onUploadProgress: (p) => {
          const percent = p.loaded / p.total;
          setUpState({up: true, progress: Math.round(percent * 99)});
        }
      });
      setCancelUp(null);
      setUpState({progress: 100, up: false});
      // remote pin order
      const PinEndpoint = currentPinEndpoint.value;
      await axios.request({
        method: 'POST',
        url: `${PinEndpoint}/psa/pins`,
        data: {
          "cid": upResult.data.Hash,
          "name": upResult.data.Name,
        },
        headers: {Authorization: AuthBasic}
      })
      onSuccess({
        ...upResult.data,
        UpEndpoint,
        PinEndpoint,
      });
    } catch (e) {
      setUpState({progress: 0, up: false});
      setBusy(false);
      console.error(e);
      setError(e.message);
    }
  }

  return <Modal
    header={t('Upload File')}
    size={'medium'}
    onClose={_onClose}
    open={true}
  >
    <Modal.Content>
      <Modal.Columns>
        <div style={{paddingLeft: '2rem', width: '100%'}}>
          <Label label={file.name}/>
          <span>{`${file.size} bytes`}</span>
        </div>
      </Modal.Columns>
      <Modal.Columns>
        <Dropdown
          isDisabled={isBusy}
          help={t('File streaming and wallet authentication will be processed by the chosen gateway.')}
          label={t('Select a Web3 IPFS Gateway')}
          options={endpoints}
          value={currentEndpoint.value}
          onChange={(value) => {
            const find = endpoints.find(item => item.value === value)
            if (find) setCurrentEndpoint(find);
          }}
        />
      </Modal.Columns>
      <Modal.Columns>
        <Dropdown
          isDisabled={true}
          help={t('Your file will be pinned to IPFS for long-term storage.')}
          label={t('Select a Web3 IPFS Pinner')}
          options={pinEndpoints}
          value={currentPinEndpoint.value}
          onChange={(value) => {
            const find = pinEndpoints.find(item => item.value === value)
            if (find) setCurrentPinEndpoint(find);
          }}
        />
      </Modal.Columns>
      <Modal.Columns hint={!hasAccounts && <p className='file-info'
                                              style={{padding: 0}}>{t('Need to connect a plug-in wallet or import an account first')}</p>}>
        <InputAddress
          label={t('Please choose account')}
          isDisabled={!hasAccounts || isBusy}
          labelExtra={
            <Available
              label={t('transferrable')}
              params={account}
            />
          }
          defaultValue={account}
          onChange={onAccountChange}
          type='account'
        />
        {
          !upState.up && isLocked && !isInjected && <Password
            help={t('The account\'s password specified at the creation of this account.')}
            isError={false}
            label={t('password')}
            onChange={setPassword}
            value={password}
          />
        }
        <Progress progress={upState.progress}
                  style={{marginLeft: '2rem', marginTop: '2rem', width: 'calc(100% - 2rem)'}}/>
        {
          errorText && <div style={{
            wordBreak: 'break-all',
            whiteSpace: 'pre-wrap',
            color: 'orangered',
            padding: '1rem'
          }}>{errorText}</div>
        }
      </Modal.Columns>
    </Modal.Content>
    <Modal.Actions>
      <Button
        isDisabled={!hasAccounts || fileSizeError}
        icon={'arrow-circle-up'}
        label={t('Upload')}
        isBusy={isBusy}
        onClick={_onClickUp}
      />
    </Modal.Actions>
  </Modal>
}

export default React.memo(UploadModal)
