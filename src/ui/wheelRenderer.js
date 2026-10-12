// @ts-check

/**
 * SVG wheel renderer with radial labels
 * Per spec §4: Labels rotate from center outward, read inside-out
 */

import { wedgeAngles } from './wheelMath.js';

/**
 * Render wheel as SVG
 * @param {{id: string, prob: number}[]} table
 * @param {string} pickedId
 * @param {any} data - Game data for name lookup
 * @param {number} rotationAngle - Current rotation in radians
 * @param {number} size - Canvas size
 * @returns {string} SVG markup
 */
export function renderWheelSVG(table, pickedId, data, rotationAngle = 0, size = 600) {
  const wedges = wedgeAngles(table);
  const centerX = size / 2;
  const centerY = size / 2;
  const radius = size * 0.4;
  const hubRadius = size * 0.1;
  
  const colors = [
    '#d4af37', '#c5a028', '#b69121', '#9d7d1c', '#8b6f19',
    '#7a6116', '#695313', '#594510', '#48370d', '#37290a'
  ];
  
  let svg = `<svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<rect width="${size}" height="${size}" fill="#0a0a0a"/>`;
  
  // Apply rotation to the entire wheel group
  svg += `<g transform="rotate(${(rotationAngle * 180 / Math.PI).toFixed(3)} ${centerX} ${centerY})">`;
  
  // Draw wedges
  wedges.forEach((wedge, i) => {
    const startX = centerX + Math.cos(wedge.startAngle - Math.PI / 2) * hubRadius;
    const startY = centerY + Math.sin(wedge.startAngle - Math.PI / 2) * hubRadius;
    const endX = centerX + Math.cos(wedge.endAngle - Math.PI / 2) * hubRadius;
    const endY = centerY + Math.sin(wedge.endAngle - Math.PI / 2) * hubRadius;
    
    const outerStartX = centerX + Math.cos(wedge.startAngle - Math.PI / 2) * radius;
    const outerStartY = centerY + Math.sin(wedge.startAngle - Math.PI / 2) * radius;
    const outerEndX = centerX + Math.cos(wedge.endAngle - Math.PI / 2) * radius;
    const outerEndY = centerY + Math.sin(wedge.endAngle - Math.PI / 2) * radius;
    
    const largeArc = (wedge.endAngle - wedge.startAngle) > Math.PI ? 1 : 0;
    
    const pathData = `M ${startX} ${startY} L ${outerStartX} ${outerStartY} A ${radius} ${radius} 0 ${largeArc} 1 ${outerEndX} ${outerEndY} L ${endX} ${endY} A ${hubRadius} ${hubRadius} 0 ${largeArc} 0 ${startX} ${startY} Z`;
    
    const isHighlighted = wedge.id === pickedId || (wedge.isOthers && wedge.otherIds?.includes(pickedId));
    const color = colors[i % colors.length];
    const fillColor = isHighlighted ? color : darkenColor(color, 0.4);
    
    svg += `<path d="${pathData}" fill="${fillColor}" stroke="#1a1a1a" stroke-width="2"/>`;
  });
  
  // Draw labels
  wedges.forEach(wedge => {
    const angleSpan = wedge.endAngle - wedge.startAngle;
    const angleDeg = angleSpan * (180 / Math.PI);
    
    // Only show label if wedge is large enough (>10°)
    if (angleDeg < 10) return;
    
    // Find entry in table to get label if present
    const entry = table.find(e => e.id === wedge.id);
    const name = getLabel(wedge.id, entry, data);
    
    // Place anchor at inner edge (near hub), text extends outward
    const anchorRadius = hubRadius + 5; // 5px clearance from hub
    const centerAngleDeg = (wedge.centerAngle * 180 / Math.PI);
    const anchorX = centerX + Math.cos(wedge.centerAngle - Math.PI / 2) * anchorRadius;
    const anchorY = centerY + Math.sin(wedge.centerAngle - Math.PI / 2) * anchorRadius;
    
    // Rotate so text extends radially outward
    const rotateDeg = centerAngleDeg - 90;
    
    // Calculate available space and font size
    const availableLength = radius - anchorRadius;
    const charWidth = 0.6; // Approximate char width as fraction of font size
    const nameLength = name.length;
    
    // Size to fit: fontSize such that name fits in available length
    const maxFontFromAngle = angleDeg * 0.8;
    const maxFontFromSpace = availableLength / (nameLength * charWidth);
    const fontSize = Math.min(20, maxFontFromAngle, maxFontFromSpace);
    
    svg += `<text x="${anchorX}" y="${anchorY}" 
      font-size="${fontSize}" 
      fill="white" 
      text-anchor="start" 
      dominant-baseline="middle"
      transform="rotate(${rotateDeg}, ${anchorX}, ${anchorY})">${escapeXML(name)}</text>`;
  });
  
  // Hub with button appearance
  svg += `<circle cx="${centerX}" cy="${centerY}" r="${hubRadius}" fill="#2a2a2a" stroke="#d4af37" stroke-width="4"/>`;
  svg += `<circle cx="${centerX}" cy="${centerY}" r="${hubRadius * 0.7}" fill="#1a1a1a" stroke="#d4af37" stroke-width="2"/>`;
  
  svg += `</g>`; // Close rotation group
  
  // Crimson pointer at top (outside rotation group, always points up)
  const pointerSize = 24;
  svg += `<path d="M ${centerX} ${centerY - radius - pointerSize} L ${centerX - pointerSize/2} ${centerY - radius} L ${centerX + pointerSize/2} ${centerY - radius} Z" fill="#dc143c" stroke="#000" stroke-width="3"/>`;
  
  svg += `</svg>`;
  
  return svg;
}

/**
 * Get name for display
 * @param {string} id
 * @param {any} data
 * @returns {string}
 */
function getName(id, data) {
  if (id === '__others__') return 'Others';
  
  // Try various data sources
  if (data.races?.[id]) return data.races[id].name || id;
  if (data.powers?.[id]) return data.powers[id].name || id;
  if (data.traits?.[id]) return data.traits[id].name || id;
  
  return id;
}

/**
 * Get label for display (for speed/durability stages, shows label if present)
 * @param {string} id
 * @param {any} entry - Table entry with optional label field
 * @param {any} data
 * @returns {string}
 */
function getLabel(id, entry, data) {
  if (entry && entry.label) return entry.label;
  return getName(id, data);
}

function darkenColor(hex, factor) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  
  const nr = Math.floor(r * factor);
  const ng = Math.floor(g * factor);
  const nb = Math.floor(b * factor);
  
  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
}

function escapeXML(str) {
  return str.replace(/[<>&'"]/g, c => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;'
  }[c] || c));
}
