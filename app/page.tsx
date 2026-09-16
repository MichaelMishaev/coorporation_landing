import { ScrollWorldExperience } from "./components/ScrollWorldExperience";
import { Footer } from "./components/sections/Footer";

/**
 * Landing page is the scroll-world cinematic flight (north → south, one
 * continuous forward glide) generated via the scroll-world skill. Replaces
 * the previous section-stack layout (Hero/MissionBand/WhoWeAre/Lineup/
 * VolunteerBand/ClosingCta) per explicit direction. The engine renders its
 * own topbar (brand + route nav + join CTA), so the old Nav is dropped;
 * Footer stays, reachable after scrolling past the full flight.
 */
export default function Home() {
  return (
    <>
      <main>
        <ScrollWorldExperience />
      </main>
      <Footer />
    </>
  );
}
