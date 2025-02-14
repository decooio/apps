// Copyright 2017-2021 @polkadot/app-files authors & contributors
// SPDX-License-Identifier: Apache-2.0

import FileSaver from 'file-saver';
import React, { useCallback, useContext, useRef, useState } from 'react';
import styled from 'styled-components';

import { useFiles } from '@polkadot/app-files/hooks';
import UploadModal from '@polkadot/app-files/UploadModal';
import { Badge, Button, CopyButton, StatusContext, Table } from '@polkadot/react-components';
import { ActionStatusBase, QueueProps } from '@polkadot/react-components/Status/types';

import { useTranslation } from './translate';
import { SaveFile } from './types';

const MCopyButton = styled(CopyButton)`
  .copySpan {
    display: none;
  }
`;

const ItemFile = styled.tr`
  height: 3.5rem;

  .end {
    text-align: end;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    align-items: center;
  }
`;

function createUrl (f: SaveFile) {
  const endpoint = f.UpEndpoint || 'https://ipfs.io';

  return `${endpoint}/ipfs/${f.Hash}?filename=${f.Name}`;
}

const createOnDown = (f: SaveFile) => () => {
  FileSaver.saveAs(createUrl(f), f.Name);
};

type FunInputFile = (e: React.ChangeEvent<HTMLInputElement>) => void

function CrustFiles (): React.ReactElement {
  const { t } = useTranslation();
  const [showUpMode, setShowUpMode] = useState(false);
  const wFiles = useFiles();
  const [file, setFile] = useState<File | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);
  const _clickUploadFile = useCallback(() => {
    if (!inputRef.current) return;
    inputRef.current.click();
  }, [inputRef]);
  const _onInputFile = useCallback<FunInputFile>((e) => {
    const files = e.target.files;

    if (files && files[0]) {
      const file = files[0];

      e.target.value = '';
      setFile(file);
      setShowUpMode(true);
    }
  }, [setFile, setShowUpMode]);
  const { queueAction } = useContext<QueueProps>(StatusContext);
  const _onImportResult = useCallback<(m: string, s?: ActionStatusBase['status']) => void>(
    (message, status = 'queued') => {
      queueAction && queueAction({
        action: t('Import files'),
        message,
        status
      });
    },
  [queueAction, t]
  );
  const importInputRef = useRef<HTMLInputElement>(null);
  const _clickImport = useCallback(() => {
    if (!importInputRef.current) return;
    importInputRef.current.click();
  }, [importInputRef]);
  const _onInputImportFile = useCallback<FunInputFile>((e) => {
    try {
      _onImportResult(t('Importing'));
      const fileReader = new FileReader();
      const files = e.target.files;

      if (!files) return;
      fileReader.readAsText(files[0], 'UTF-8');

      if (!(/(.json)$/i.test(e.target.value))) {
        return _onImportResult(t('file error'), 'error');
      }

      fileReader.onload = (e) => {
        const _list = JSON.parse(e.target?.result as string) as SaveFile[];

        if (!Array.isArray(_list)) {
          return _onImportResult(t('file content error'), 'error');
        }

        const fitter: SaveFile[] = [];
        const mapImport: { [key: string]: boolean } = {};

        for (const item of _list) {
          if (item.Hash && item.Name && item.UpEndpoint && item.PinEndpoint) {
            fitter.push(item);
            mapImport[item.Hash] = true;
          }
        }

        const filterOld = wFiles.files.filter((item) => !mapImport[item.Hash]);

        wFiles.setFiles([...fitter, ...filterOld]);
        _onImportResult(t('Import Success'), 'success');
      };
    } catch (e) {
      _onImportResult(t('file content error'), 'error');
    }
  }, [wFiles, _onImportResult, t]);

  const _onClose = useCallback(() => {
    setShowUpMode(false);
  }, []);

  const _onSuccess = useCallback((res: SaveFile) => {
    setShowUpMode(false);
    const filterFiles = wFiles.files.filter((f) => f.Hash !== res.Hash);

    wFiles.setFiles([res, ...filterFiles]);
  }, [wFiles]);

  const _export = useCallback(() => {
    const blob = new Blob([JSON.stringify(wFiles.files)], { type: 'application/json; charset=utf-8' });

    FileSaver.saveAs(blob, 'files.json');
  }, [wFiles]);

  return <main>
    <header>
    </header>
    <input
      onChange={_onInputFile}
      ref={inputRef}
      style={{ display: 'none' }}
      type={'file'}
    />
    <input
      onChange={_onInputImportFile}
      ref={importInputRef}
      style={{ display: 'none' }}
      type={'file'}
    />
    {
      file && showUpMode &&
      <UploadModal
        file={file}
        onClose={_onClose}
        onSuccess={_onSuccess}
      />
    }
    <div style={{ display: 'flex', paddingBottom: '1.5rem' }}>
      <Button
        icon={'upload'}
        label={t('Upload File')}
        onClick={_clickUploadFile}
      />
      <div style={{ flex: 1 }} />
      <Button
        icon={'file-import'}
        label={t('Import')}
        onClick={_clickImport}
      />
      <Button
        icon={'file-export'}
        label={t('Export')}
        onClick={_export}
      />
    </div>
    <Table
      empty={t<string>('No files')}
      emptySpinner={t<string>('Loading')}
      header={[
        [t('files'), 'start', 2],
        [t('file cid'), 'expand', 2],
        [undefined, 'start'],
        [t('file size'), 'expand', 2],
        [t('status'), 'expand'],
        [t('action'), 'expand'],
        []
      ]}
    >
      {wFiles.files.map((f, index) =>
        <ItemFile key={`files_item-${index}`}>
          <td
            className=''
            colSpan={2}
          >{f.Name}</td>
          <td
            className='end'
            colSpan={2}
          >{f.Hash}</td>
          <td
            className=''
            colSpan={1}
          >
            <MCopyButton value={f.Hash}>
              <Badge
                color='highlight'
                hover={t<string>('Copy file cid')}
                icon='copy'
              />
            </MCopyButton>
          </td>
          <td
            className='end'
            colSpan={2}
          >{`${f.Size} bytes`}</td>
          <td
            className='end'
            colSpan={1}
          >
            <a
              href={'https://apps.crust.network/?rpc=wss%3A%2F%2Frpc.crust.network#/storage_files'}
              rel='noreferrer'
              target='_blank'
            >{t('View status in Crust')}</a>
          </td>
          <td
            className='end'
            colSpan={1}
          >
            <div className='actions'>
              <Badge
                color='highlight'
                hover={t<string>('Download')}
                icon='download'
                onClick={createOnDown(f)}
              />
              <MCopyButton value={createUrl(f)}>
                <Badge
                  color='highlight'
                  hover={t<string>('Copy link')}
                  icon='copy'
                />
              </MCopyButton>

            </div>
          </td>
          <td colSpan={1} />
        </ItemFile>
      )}
    </Table>
    <div>
      {t('Note: The file list is cached locally, switching browsers or devices will not keep displaying the original browser information.')}
    </div>
  </main>;
}

export default React.memo(CrustFiles);
