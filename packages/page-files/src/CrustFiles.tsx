// Copyright 2017-2021 @polkadot/app-files authors & contributors
// SPDX-License-Identifier: Apache-2.0

import React, {useCallback, useContext, useRef, useState} from "react";
import {Badge, Button, CopyButton, StatusContext, Table} from "@polkadot/react-components";
import {useTranslation} from './translate'
import UploadModal from "@polkadot/app-files/UploadModal";
import {SaveFile} from "./types";
import {useFiles} from "@polkadot/app-files/hooks";
import styled from "styled-components";
import FileSaver from "file-saver";

const MCopyButton = styled(CopyButton)`
  .copySpan {
    display: none;
  }
`

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
`

function createUrl(f: SaveFile) {
  const endpoint = f.UpEndpoint || "https://ipfs.io"
  return `${endpoint}/ipfs/${f.Hash}?filename=${f.Name}`
}

function CrustFiles() {
  const {t} = useTranslation()
  const [showUpMode, setShowUpMode] = useState(false)
  const wFiles = useFiles()
  const [file, setFile] = useState<File | undefined>(undefined)
  const inputRef = useRef<HTMLInputElement>(null)
  const _clickUploadFile = useCallback(() => {
    if (!inputRef.current) return;
    inputRef.current.click()
  }, [inputRef.current])
  const _onInputFile = useCallback((e) => {
    const files = e.target.files
    if (files && files[0]) {
      const file = files[0]
      e.target.value = '';
      setFile(file)
      setShowUpMode(true)
    }
  }, [inputRef.current])
  const {queueAction} = useContext(StatusContext);
  const _onImportResult = useCallback(
    (message, status = 'queued') => {
      queueAction && queueAction({
        action: t('Import files'),
        message,
        status
      });
    },
    [queueAction, t]
  );
  const importInputRef = useRef<HTMLInputElement>(null)
  const _clickImport = useCallback(() => {
    if (!importInputRef.current) return;
    importInputRef.current.click()
  }, [importInputRef.current])
  const _onInputImportFile = useCallback((e) => {
    try {
      _onImportResult(t('Importing'))
      const fileReader = new FileReader();
      fileReader.readAsText(e.target.files[0], 'UTF-8');
      if (!(/(.json)$/i.test(e.target.value))) {
        return _onImportResult(t('file error'), 'error');
      }
      fileReader.onload = e => {
        const _list = JSON.parse(e.target?.result as string) as SaveFile[];
        if (!Array.isArray(_list)) {
          return _onImportResult(t('file content error'), 'error');
        }
        const fitter: SaveFile[] = []
        const mapImport: { [key: string]: boolean } = {}
        for (const item of _list) {
          if (item.Hash && item.Name && item.UpEndpoint && item.PinEndpoint) {
            fitter.push(item)
            mapImport[item.Hash] = true;
          }
        }
        const filterOld = wFiles.files.filter(item => !mapImport[item.Hash])
        wFiles.setFiles([...fitter, ...filterOld])
        _onImportResult(t('Import Success'), 'success');
      };
    } catch (e) {
      _onImportResult(t('file content error'), 'error')
    }
  }, [importInputRef.current, wFiles])

  const _onClose = useCallback(() => {
    setShowUpMode(false)
  }, [])

  const _onSuccess = useCallback((res: SaveFile) => {
    setShowUpMode(false)
    const filterFiles = wFiles.files.filter(f => f.Hash !== res.Hash)
    wFiles.setFiles([res, ...filterFiles])
  }, [wFiles])

  const _export = useCallback(() => {
    const blob = new Blob([JSON.stringify(wFiles.files)], {type: 'application/json; charset=utf-8'});
    FileSaver.saveAs(blob, `files.json`);
  }, [wFiles])

  return <main>
    <header>
    </header>
    <input
      style={{display: "none"}}
      type={'file'}
      ref={inputRef}
      onChange={_onInputFile}
    />
    <input
      style={{display: "none"}}
      type={'file'}
      ref={importInputRef}
      onChange={_onInputImportFile}
    />
    {file && showUpMode && <UploadModal
      file={file}
      onClose={_onClose}
      onSuccess={_onSuccess}
    />}
    <div style={{display: 'flex', paddingBottom: '1.5rem'}}>
      <Button
        icon={'upload'}
        label={t('Upload File')}
        onClick={_clickUploadFile}
      />
      <div style={{flex: 1}}/>
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
      emptySpinner={t('Loading')}
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
          <td colSpan={2} className=''>{f.Name}</td>
          <td colSpan={2} className='end'>{f.Hash}</td>
          <td colSpan={1} className=''>
            <MCopyButton value={f.Hash}>
              <Badge
                color='highlight'
                icon='copy'
                hover={t('Copy file cid')}
              />
            </MCopyButton>
          </td>
          <td colSpan={2} className='end'>{`${f.Size} bytes`}</td>
          <td colSpan={1} className='end'>
            <a href={'https://apps.crust.network/?rpc=wss%3A%2F%2Frpc.crust.network#/storage_files'}
               target='_blank'>{t('View status in Crust')}</a>
          </td>
          <td colSpan={1} className='end'>
            <div className='actions'>
              <Badge
                color='highlight'
                icon='download'
                hover={t('Download')}
                onClick={() => FileSaver.saveAs(createUrl(f), f.Name)}
              />
              <MCopyButton value={createUrl(f)}>
                <Badge
                  color='highlight'
                  icon='copy'
                  hover={t('Copy link')}
                />
              </MCopyButton>

            </div>
          </td>
          <td colSpan={1}/>
        </ItemFile>
      )}
    </Table>
    <div>
      {t('Note: The file list is cached locally, switching browsers or devices will not keep displaying the original browser information.')}
    </div>
  </main>
}

export default React.memo(CrustFiles)
