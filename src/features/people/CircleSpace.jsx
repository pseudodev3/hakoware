import { ContractsView } from '../friendship/components/ContractsView';
import { ViewTabs } from '../../shared/components/ViewTabs';
import { Connections } from './Connections';
import './People.css';

export const CircleSpace = ({ section = 'duos', connectionId, ...props }) => {
  const selected = section === 'connections' ? section : 'duos';
  if (selected === 'connections' && connectionId) return <Connections key={connectionId} connectionId={connectionId} onNavigate={props.onNavigate} onAddFriend={props.onAddFriend} />;
  return <div className="circle-space"><ViewTabs id="circle" label="Your circle" className="circle-space-tabs" value={selected} items={[{ value: 'duos', label: 'Duos' }, { value: 'connections', label: 'Connections' }]} onChange={value => props.onNavigate('contracts', { section: value })} /><div role="tabpanel" id={`circle-panel-${selected}`} aria-labelledby={`circle-tab-${selected}`}>{selected === 'duos' ? <ContractsView {...props} /> : <Connections onNavigate={props.onNavigate} onAddFriend={props.onAddFriend} />}</div></div>;
};
