/*
 * fluids-codec.js — light obfuscation for the fluid-capacity data files.
 *
 * This is deliberately OBFUSCATION, not security: the same key is shipped in
 * the public lookup page, so a determined person could recover the data. It
 * keeps the parsed VW figures out of plain sight (not greppable in the repo,
 * not search-indexed) with zero friction for techs — the agreed trade-off.
 *
 * Scheme: JSON -> UTF-8 bytes -> XOR with a repeating key -> base64. The
 * browser side (docs/fluids.html) reimplements the same decode with atob +
 * TextDecoder and the identical KEY. No dependencies on either side.
 */
var KEY = "h@hns-fluid-codec-v1-2026";

function xorBytes(buf) {
  var out = Buffer.alloc(buf.length);
  for (var i = 0; i < buf.length; i++) out[i] = buf[i] ^ KEY.charCodeAt(i % KEY.length);
  return out;
}

function encode(obj) {
  return xorBytes(Buffer.from(JSON.stringify(obj), "utf8")).toString("base64");
}

function decode(b64) {
  return JSON.parse(xorBytes(Buffer.from(b64, "base64")).toString("utf8"));
}

module.exports = { KEY: KEY, encode: encode, decode: decode };
