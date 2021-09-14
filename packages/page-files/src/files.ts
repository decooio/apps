// Copyright 2017-2021 @polkadot/app-files authors & contributors
// SPDX-License-Identifier: Apache-2.0

import {NormalizedFile} from './types';

export function normalizeFiles(files: any): NormalizedFile[] {
  const streams = []

  for (const file of files) {
    console.log('normalizeFiles', file);
    streams.push({
      path: file.filepath || file.webkitRelativePath || file.name,
      content: file,
      size: file.size
    })
  }

  return streams
}
