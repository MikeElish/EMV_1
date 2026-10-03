import { getGlonassMapData } from "@/actions/admin/glonass-map";
import { GlonassMap } from "@/components/admin/GlonassMap";

export default async function GlonassMapPage() {
  return <GlonassMap initial={await getGlonassMapData()} />;
}
