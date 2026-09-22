import { escAttr } from "../utils/html.js";

// The vehicle as a picture: one schematic side view that changes with what the
// vehicle is doing. Drawn by hand as inline SVG, a few hundred bytes, coloured
// through the card's CSS variables so it follows the theme. The traction
// battery in the floor carries the charge level.
//
//   parked     the car alone, at rest
//   driving    wheels turning, the road running underneath, no charger
//   connected  a charger behind the car, the cable plugged in
//   charging   the same with energy running through the cable and a bolt on the battery
//
// With a picture of the real car (`vehicle_images`, or an image entity of the
// vehicle's integration) the drawing of the car gives way to it and the scene
// around it stays: ground, road and wind, charger and cable, and a bolt badge
// in place of the one on the battery. A photo has no wheels to turn and no
// floor to look into, so the charge level is left to the bar underneath.
//
// Geometry (320 wide, the empty strip above the roof cut off by the viewBox):
// the car faces right, wheels at x 92 and 228, ground at y 97, the charge port
// on the rear wing, the charger at the left edge. Every moving part is animated in CSS (styles.js) and stands still under
// prefers-reduced-motion.
const BODY    = "M40,80 L40,60 Q40,52 50,49 L74,32 Q80,27 90,27 L168,27 Q178,27 186,33 L214,50 L266,56 Q284,59 284,72 L284,80 L250,80 A22,22 0 0 0 206,80 L114,80 A22,22 0 0 0 70,80 Z";
const WINDOWS = "M86,34 L80,48 L128,48 L128,34 Z M135,34 L135,48 L203,48 L183,35.5 Q181,34 177,34 Z";
const CABLE   = "M21,54 C36,54 28,84 42,76 C50,71 46,62 53,60";
const BOLT    = "M162,60 L154,69 L159,69 L157,76 L166,66 L161,66 Z";

const BATTERY = { x: 120, y: 62, w: 80, h: 12 };

function wheel(cx) {
  return `
    <g class="vg-wheel" style="transform-origin:${cx}px 80px">
      <circle cx="${cx}" cy="80" r="16" class="vg-tyre"/>
      <circle cx="${cx}" cy="80" r="6.5" class="vg-hub"/>
      <path d="M${cx},66 V73 M${cx},87 V94 M${cx - 14},80 H${cx - 7} M${cx + 7},80 H${cx + 14}" class="vg-spoke"/>
    </g>`;
}

// Where the photo sits: standing on the ground line and pushed against the left
// of its box, so that its rear end meets the cable whatever its proportions.
const PHOTO = { x: 46, y: 20, w: 252, h: 78 };

export const VEHICLE_STATES = ["parked", "driving", "connected", "charging"];

// Vehicle picture. Methods are mixed into EvccCard.prototype.
export const vehicleGraphic = {
  // `soc` in percent or null when nobody knows it; `label` is what a screen
  // reader gets instead of the drawing; `image` is { source, url } of a picture
  // of the real car, or null.
  _renderVehicleGraphic(state, soc, label, image = null) {
    const level   = soc === null ? 0 : Math.max(0, Math.min(100, soc));
    const fillW   = Math.round(BATTERY.w * level) / 100;
    const tone    = state === "charging" ? "charging" : level < 20 ? "low" : "";
    const plugged = state === "connected" || state === "charging";

    const charger = plugged ? `
      <g class="vg-charger">
        <rect x="7" y="40" width="14" height="57" rx="3"/>
        <rect x="10" y="45" width="8" height="6" rx="1.5" class="vg-charger-light"/>
      </g>
      <path d="${CABLE}" class="vg-cable"/>
      ${state === "charging" ? `<path d="${CABLE}" class="vg-cable-flow"/>` : ""}` : "";

    const motion = state === "driving" ? `
      <path d="M4,52 H26 M10,62 H30 M2,72 H24" class="vg-wind"/>
      <path d="M0,97 H320" class="vg-road"/>` : `<path d="M0,97 H320" class="vg-ground"/>`;

    return `
      <div class="vehicle-graphic" data-vehicle-state="${state}">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 18 320 86" role="img" aria-label="${escAttr(label)}">
          ${motion}
          ${charger}
          ${image ? `
          <g class="vg-car">
            <image class="vg-photo" href="${escAttr(image.url)}" data-vehicle-image="${escAttr(image.source)}"
                   x="${PHOTO.x}" y="${PHOTO.y}" width="${PHOTO.w}" height="${PHOTO.h}" preserveAspectRatio="xMinYMax meet"/>
          </g>
          ${plugged ? `<circle cx="53" cy="60" r="3.5" class="vg-plug"/>` : ""}
          ${state === "charging" ? `<g class="vg-badge"><circle cx="262" cy="34" r="11"/><path d="${BOLT}" transform="translate(102,-34)" class="vg-bolt"/></g>` : ""}` : `
          <g class="vg-car">
            <path d="${BODY}" class="vg-body"/>
            <path d="${WINDOWS}" class="vg-window"/>
            <path d="M131.5,33 V80" class="vg-seam"/>
            <rect x="268" y="60" width="12" height="5" rx="2.5" class="vg-lamp vg-lamp-front"/>
            <rect x="40" y="57" width="5" height="9" rx="2" class="vg-lamp vg-lamp-rear"/>
            <circle cx="55" cy="60" r="3" class="vg-port"/>
            <rect x="${BATTERY.x}" y="${BATTERY.y}" width="${BATTERY.w}" height="${BATTERY.h}" rx="3" class="vg-battery"/>
            ${soc === null ? "" : `<rect x="${BATTERY.x}" y="${BATTERY.y}" width="${fillW}" height="${BATTERY.h}" rx="3" class="vg-battery-fill ${tone}"/>`}
            ${state === "charging" ? `<path d="${BOLT}" class="vg-bolt"/>` : ""}
            ${wheel(92)}
            ${wheel(228)}
          </g>`}
        </svg>
      </div>`;
  },
};
