/**
 * The switch of the pixel layer. Outside a browser there is no canvas, so the layer opens out (as it
 * always did for tests and tools); what these tests guard is the switch itself, which is the thing
 * the button of the menu moves.
 */
import { describe, expect, it } from 'vitest';
import { type ArtFamily, pixelArt, pixelLayerOn, setPixelLayer, togglePixelLayer } from '../src/render/artSwitch';

const FAMILIES: ArtFamily[] = ['residential', 'commercial', 'industrial', 'plazas', 'calles', 'tierra', 'costa', 'transporte', 'energia', 'servicios', 'arboles', 'vehiculos'];

describe('the switch of the pixel layer', () => {
  it('opens out when there is nobody to paint for', () => {
    expect(pixelLayerOn()).toBe(false);
    expect(pixelArt('residential')).toBe(false);
  });

  it('turns every family on with the button, and off again', () => {
    expect(togglePixelLayer()).toBe(true);
    expect(pixelLayerOn()).toBe(true);
    // No page and no list of families: on means all of them, which is what the button promises.
    for (const family of FAMILIES) expect(pixelArt(family)).toBe(true);
    expect(togglePixelLayer()).toBe(false);
    for (const family of FAMILIES) expect(pixelArt(family)).toBe(false);
  });

  it('obeys setPixelLayer, which is what a saved preference would use', () => {
    setPixelLayer(true);
    expect(pixelArt('servicios')).toBe(true);
    setPixelLayer(false);
    expect(pixelArt('servicios')).toBe(false);
  });
});
