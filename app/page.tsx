import { Nav } from "./components/Nav";
import { RevealSection } from "./components/RevealSection";
import { Hero } from "./components/sections/Hero";
import { MissionBand } from "./components/sections/MissionBand";
import { WhoWeAre } from "./components/sections/WhoWeAre";
import { Lineup } from "./components/sections/Lineup";
import { VolunteerBand } from "./components/sections/VolunteerBand";
import { ClosingCta } from "./components/sections/ClosingCta";
import { Footer } from "./components/sections/Footer";

/**
 * Section order per spec §5. §5.5 (optional benefit grid) is omitted —
 * ships only once the campaign supplies real benefit copy (spec §5.5, §9).
 *
 * Entrance animation (spec §3.7) applies to at most the first three sections
 * below the fold: mission band, who-we-are, lineup. Hero and footer stay static.
 */
export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <RevealSection>
          <MissionBand />
        </RevealSection>
        <RevealSection>
          <WhoWeAre />
        </RevealSection>
        <RevealSection>
          <Lineup />
        </RevealSection>
        <VolunteerBand />
        <ClosingCta />
      </main>
      <Footer />
    </>
  );
}
