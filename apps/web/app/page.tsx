import { Shell } from "../components/shell";
import { getDashboard, getRecommendations } from "../lib/api";

export default async function HomePage() {
  const [dashboard, recommendations] = await Promise.all([
    getDashboard(),
    getRecommendations()
  ]);

  return <Shell dashboard={dashboard} recommendations={recommendations} />;
}
