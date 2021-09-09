// Copyright 2017-2021 @polkadot/app-files authors & contributors
// SPDX-License-Identifier: Apache-2.0

import {useCallback, useEffect, useMemo, useState} from "react";
import {SaveFile} from "./types";
import store from 'store';

export interface Files {
  files: SaveFile[],
  isLoad: boolean,
}

export interface WrapFiles extends Files {
  setFiles: (files: SaveFile[]) => void
}

export function useFiles(): WrapFiles {
  const [filesObj, setFilesObj] = useState<Files>({files: [], isLoad: true})
  useEffect(() => {
    try {
      const f = store.get('files', filesObj) as Files
      f.isLoad = false;
      setFilesObj(f)
    } catch (e) {
      console.error(e)
    }
  }, [])
  const setFiles = useCallback((nFiles: SaveFile[]) => {
    const nFilesObj = { ...filesObj, files: nFiles}
    setFilesObj(nFilesObj)
    store.set('files', nFilesObj)
  }, [filesObj])
  return useMemo(() => ({ ...filesObj, setFiles}), [filesObj, setFiles])
}
