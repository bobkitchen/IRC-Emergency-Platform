import {
  Crosshair,
  Landmark,
  Users,
  Truck,
  ShieldCheck,
  HeartHandshake,
  Settings,
  BarChart3,
  ClipboardList,
  Handshake,
  Link,
  Radio,
  MapPin,
} from 'lucide-react';

const SECTOR_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  rmie: Crosshair,
  finance: Landmark,
  people_culture: Users,
  supply_chain: Truck,
  safety_security: ShieldCheck,
  safeguarding: HeartHandshake,
  technical_programs: Settings,
  meal: BarChart3,
  grants: ClipboardList,
  partnerships: Handshake,
  integra: Link,
  response_mgmt: Radio,
};

interface Props {
  sectorId: string;
  className?: string;
}

export default function SectorIcon({ sectorId, className = 'w-4 h-4' }: Props) {
  const Icon = SECTOR_ICONS[sectorId] || MapPin;
  return <Icon className={className} />;
}
