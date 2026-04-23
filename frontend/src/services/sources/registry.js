// Registry central des connecteurs. Ajouter une source = l'importer + l'ajouter ici.
// L'aggregator n'en sait rien de plus.

import { leboncoinConnector } from './leboncoin.js';
import { lacentraleConnector } from './lacentrale.js';
import { mobiledeConnector } from './mobilede.js';
import { autoscout24Connector } from './autoscout24.js';

const ALL_CONNECTORS = [
  leboncoinConnector,
  lacentraleConnector,
  mobiledeConnector,
  autoscout24Connector,
];

export function getConnectors({ ids = null, countries = null, onlyEnabled = true } = {}) {
  return ALL_CONNECTORS.filter((c) => {
    if (onlyEnabled && !c.enabled) return false;
    if (ids && ids.length && !ids.includes(c.id)) return false;
    if (countries && countries.length && !countries.includes(c.country)) return false;
    return true;
  });
}

export function getAllConnectorsMeta() {
  return ALL_CONNECTORS.map(({ id, label, country, enabled, priority, capabilities }) => ({
    id, label, country, enabled, priority, capabilities,
  }));
}
