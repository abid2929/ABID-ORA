<?php
/* Site guide for Abidora AI (21 Nov 2026): the 28 main worlds and how the site works, so the assistant can
   answer "what is on this site / how do I use it" correctly. Keep it in step with src/data/worlds30.ts. */
function ab_ai_site_guide(): string {
  return <<<TXT
MAIN WORLDS (the 28 worlds shown first on the home page; links are relative to the site root):
Fashion & Lifestyle, all inside ONE page, Fashion World (world 001, worlds/w/?w=1), with 4 tabs:
- Clothes (#clothes): 34 real 3D clothes (coats, dresses, sarees, hoodies, denim, tees). Pick a piece from the photo grid, turn it, choose a part and change its colour, matte/satin/gloss finish, compare with the original scan.
- Shoes (#shoes): 11 real scanned shoes (boots, heels, flats, high-tops). Views include the sole.
- Bags (#bags): 8 real 3D bags and backpacks.
- Watches & jewellery (#watches): 19 real 3D watches, rings, necklaces, bracelets and sunglasses, all real models.
Every fashion model is a real licensed 3D model (CC BY), brand logos removed; credits are shown under each model.
Technology & AI: AI Creation Studio (world 092), AI Image & Design (089), Future Technology: a real quantum circuit simulator (057), Robotics World: program robots with real kinematics (056), Digital Innovation: how computers work, bits, gates, a small CPU (063).
Games & Interactive: Racing World (011): a 3-lap 3D race at sunset against 3 rivals with real 3D cars (Street Legend, Night Runner, Hover Bike), real car physics, drift fills nitro; keys arrows/WASD, Space drift, Shift nitro, C camera; on phones touch buttons with auto gas. Open Exploration (082): Isle of Abidora, fly over an island and find 8 hidden light shards. Puzzle World (099): Prism Lab, turn mirrors to guide light to crystals. Space Adventure (036): Starfall Run, fly a ship through 3 sectors to real nearby stars. Simulation World (041): Demolition Lab, real 3D physics with cannon, blast and wrecking ball, gravity of Earth/Moon/Mars/Jupiter.
Nature & Wildlife: Ocean (028), Wildlife (030), Forest (029), Mountain (032).
Space & Science: Galaxy (037), Solar System (038), Astronomy: tonight's real sky (039), Science Discovery: rerun famous experiments (040).
Architecture & Design: Architecture (019), Interior Design (020), Future City (021).
Art & Creativity: Digital Art (045), Photography: learn a real camera (046), Creative Design studio (051).

HOW THE SITE WORKS:
- Home page: big photo slider at the top (arrows to change), the 28 main worlds as cards (swipe on phones, "See all" for a grid), the 7 world families as a photo mosaic, the Studio, the founder and contact.
- Every world page has a Back button, previous/next world arrows and a link to all worlds. On phones there is a bottom bar.
- 3D pages: drag to turn, scroll or pinch to zoom; buttons for 3/4, Front, Side and Back views. On phones the edit options open in a sheet from the bottom (Edit button) and close by swiping down. Extra options are under "More options".
- Background music: on 3D pages lively beat music starts after the first tap or click, at a medium volume. The small music button (bottom right, next to the AI button) turns it off; turning it on again starts a different song. All songs are free public-domain (CC0) tracks from freepd.com. On the home page the header "Sound" button plays softer music.
- Studio (home page): change the site mood, cursor, motion, grain, font style, hero photo, side and size; the choice is saved in the visitor's browser.
- Languages: English, Bengali, Spanish, French, German, Arabic, Chinese, Japanese, Korean, Hindi (switch at the top). Some translations are AI drafts.
- Abidora AI (this assistant): chat, voice call (asks before using the microphone, nothing is recorded secretly), file and image reading, and where the owner turned them on, web search, live crypto prices and image creation.
- Contact form on the home page sends a message to the owner.
If a visitor asks for something the site does not have, say so plainly instead of guessing.
TXT;
}
