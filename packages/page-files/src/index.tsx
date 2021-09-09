// Copyright 2017-2021 @polkadot/app-files authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type {KeyedEvent} from '@polkadot/react-query/types';

import React, {useRef} from 'react';

import {HelpOverlay, Tabs} from '@polkadot/react-components';
import {useTranslation} from './translate';
import {Route, Switch} from "react-router";
import CrustFiles from "@polkadot/app-files/CrustFiles";
import basicMd from '../md/basicMd.md';

interface Props {
  basePath: string;
  className?: string;
  newEvents?: KeyedEvent[];
}

function FilesApp({basePath, className}: Props): React.ReactElement<Props> {
  const {t} = useTranslation();
  const itemsRef = useRef([
    {
      isRoot: true,
      name: 'crust',
      text: t<string>('Your Files')
    }
  ]);

  return (
    <main className={className}>
      <HelpOverlay md={basicMd as string}/>
      <Tabs
        basePath={basePath}
        items={itemsRef.current}
      />
      <Switch>
        <Route>
          <CrustFiles />
        </Route>
      </Switch>
    </main>
  );
}

export default React.memo(FilesApp);
