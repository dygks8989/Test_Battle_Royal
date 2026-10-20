/* 캐릭터 미리보기 SVG — Godot 로비의 3D 미리보기를 대신하는 2D 플레이스홀더 */
(function () {
  const D = LF.data;
  const SKIN = '#d9a88a';
  const SKIN_D = '#b98a6e';

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const f = c => Math.max(0, Math.min(255, Math.round(c + 255 * amt)));
    return '#' + [f(n >> 16), f((n >> 8) & 255), f(n & 255)].map(v => v.toString(16).padStart(2, '0')).join('');
  }

  const parts = {
    hatBack(id, c) {
      if (id === 'long') return `<path d="M40 36c0-16 9-26 20-26s20 10 20 26v42H72V46H48v32h-8z" fill="${shade(c, -.08)}"/>`;
      return '';
    },
    hat(id, c) {
      const d = shade(c, -.15);
      switch (id) {
        case 'short':  return `<path d="M41 36c0-14 8-21 19-21s19 7 19 21c-4-6-10-9-19-9s-15 3-19 9z" fill="${c}"/>`;
        case 'long':   return `<path d="M40 38c0-15 9-23 20-23s20 8 20 23c-3-5-8-10-14-11-3 4-10 6-16 6-4 0-7 2-10 5z" fill="${c}"/>`;
        case 'beanie': return `<path d="M40 30c0-14 9-22 20-22s20 8 20 22z" fill="${c}"/><rect x="38" y="25" width="44" height="7" rx="3" fill="${d}"/><circle cx="60" cy="7" r="4" fill="${d}"/>`;
        case 'cap':    return `<path d="M41 33c0-12 8-19 19-19s19 7 19 19z" fill="${c}"/><path d="M62 31h28c2 0 2 4 0 4H60z" fill="${d}"/><circle cx="60" cy="14" r="2" fill="${d}"/>`;
        case 'bucket': return `<path d="M44 32l3-15c4-3 9-4 13-4s9 1 13 4l3 15z" fill="${c}"/><path d="M33 33c4-3 14-4 27-4s23 1 27 4c-4 3-14 5-27 5s-23-2-27-5z" fill="${d}"/>`;
      }
      return '';
    },
    acc(id, c) {
      const d = shade(c, -.2);
      switch (id) {
        case 'shades':  return `<rect x="45" y="34" width="30" height="7" rx="3" fill="${d}"/><rect x="46" y="35" width="12" height="5" rx="2" fill="${c}" opacity=".7"/><rect x="62" y="35" width="12" height="5" rx="2" fill="${c}" opacity=".7"/>`;
        case 'mask':    return `<path d="M44 42h32v6c0 6-7 10-16 10s-16-4-16-10z" fill="${c}"/><path d="M48 47h24M49 51h22" stroke="${d}" stroke-width="1.2"/>`;
        case 'goggles': return `<rect x="40" y="27" width="40" height="4" fill="${d}"/><rect x="45" y="24" width="13" height="9" rx="4" fill="${c}" stroke="${d}" stroke-width="1.5"/><rect x="62" y="24" width="13" height="9" rx="4" fill="${c}" stroke="${d}" stroke-width="1.5"/>`;
        case 'pack':    return `<path d="M42 62l6 48M78 62l-6 48" stroke="${d}" stroke-width="4" stroke-linecap="round"/><path d="M74 96l4 10" stroke="#888" stroke-width="1.5"/><circle cx="79" cy="110" r="5" fill="${c}"/><path d="M76 109l6 2" stroke="${d}" stroke-width="1.2"/>`;
      }
      return '';
    },
    topBack(id, c) {
      if (id === 'hoodie') return `<path d="M40 60c0-10 9-14 20-14s20 4 20 14z" fill="${shade(c, -.18)}"/>`;
      return '';
    },
    top(id, c) {
      const d = shade(c, -.16), l = shade(c, .08);
      const torso = `<path d="M34 62c6-4 16-6 26-6s20 2 26 6l2 70H32z" fill="${c}"/>`;
      const longSleeves = `<path d="M34 62 20 70l-2 70h13l4-60z" fill="${d}"/><path d="M86 62l14 8 2 70H89l-4-60z" fill="${d}"/>`;
      switch (id) {
        case 'tee':    return `<path d="M34 62 20 70l-2 26h13l4-18zM86 62l14 8 2 26H89l-4-18z" fill="${d}"/>${torso}<path d="M52 57c2 5 14 5 16 0" fill="none" stroke="${d}" stroke-width="2"/>`;
        case 'hoodie': return `${longSleeves}${torso}<rect x="44" y="104" width="32" height="16" rx="5" fill="${d}"/><path d="M55 60v18M65 60v18" stroke="${l}" stroke-width="2"/><rect x="18" y="134" width="13" height="6" fill="${shade(c, -.25)}"/><rect x="89" y="134" width="13" height="6" fill="${shade(c, -.25)}"/>`;
        case 'jacket': return `${longSleeves}${torso}<path d="M40 70h40v50H40z" fill="${shade(c, -.28)}"/><rect x="43" y="76" width="14" height="12" rx="2" fill="${shade(c, -.38)}"/><rect x="63" y="76" width="14" height="12" rx="2" fill="${shade(c, -.38)}"/><rect x="43" y="96" width="14" height="12" rx="2" fill="${shade(c, -.38)}"/><rect x="63" y="96" width="14" height="12" rx="2" fill="${shade(c, -.38)}"/><path d="M50 56l10 10 10-10" fill="none" stroke="${l}" stroke-width="3"/>`;
        case 'shirt':  return `${longSleeves}${torso}<path d="M50 56l10 12 10-12-4 0-6 7-6-7z" fill="${l}"/><path d="M60 68v62" stroke="${d}" stroke-width="1.5"/><circle cx="60" cy="80" r="1.4" fill="${d}"/><circle cx="60" cy="94" r="1.4" fill="${d}"/><circle cx="60" cy="108" r="1.4" fill="${d}"/><circle cx="60" cy="122" r="1.4" fill="${d}"/>`;
        case 'tank':   return `<path d="M40 62h8l4 10h16l4-10h8l3 70H37z" fill="${c}"/>`;
      }
      return torso;
    },
    bottom(id, c) {
      const d = shade(c, -.16);
      const full = `<path d="M32 128h56l-4 98H64l-4-70-4 70H36z" fill="${c}"/>`;
      switch (id) {
        case 'cargo':  return `${full}<rect x="34" y="160" width="12" height="18" rx="2" fill="${d}"/><rect x="74" y="160" width="12" height="18" rx="2" fill="${d}"/><rect x="32" y="128" width="56" height="7" fill="${d}"/>`;
        case 'jeans':  return `${full}<path d="M48 228l2-80M72 228l-2-80" stroke="${shade(c, .12)}" stroke-width="1.2"/><rect x="32" y="128" width="56" height="6" fill="#5a4630"/><rect x="57" y="128" width="6" height="6" fill="#c9a24a"/>`;
        case 'shorts': return `<path d="M32 128h56l-2 50H64l-4-26-4 26H34z" fill="${c}"/><rect x="32" y="128" width="56" height="6" fill="${d}"/>`;
        case 'jogger': return `${full}<path d="M36 128l-2 98M84 128l2 98" stroke="${shade(c, .35)}" stroke-width="3"/><rect x="36" y="216" width="20" height="9" fill="${d}"/><rect x="64" y="216" width="20" height="9" fill="${d}"/>`;
        case 'camo':   return `${full}<g fill="${d}"><ellipse cx="44" cy="150" rx="7" ry="4"/><ellipse cx="76" cy="146" rx="6" ry="4"/><ellipse cx="46" cy="190" rx="5" ry="6"/><ellipse cx="74" cy="186" rx="6" ry="5"/><ellipse cx="44" cy="214" rx="6" ry="3"/><ellipse cx="78" cy="212" rx="4" ry="4"/></g><g fill="${shade(c, .14)}"><ellipse cx="54" cy="138" rx="5" ry="3"/><ellipse cx="68" cy="168" rx="5" ry="4"/><ellipse cx="40" cy="172" rx="3" ry="4"/></g>`;
      }
      return full;
    },
    shoes(id, c) {
      const d = shade(c, -.2);
      switch (id) {
        case 'sneaker': return `<path d="M34 222h22v10H30c0-6 2-10 4-10zM64 222h22c2 0 4 4 4 10H64z" fill="${c}"/><rect x="29" y="231" width="27" height="5" rx="2" fill="#f2f2f2"/><rect x="64" y="231" width="27" height="5" rx="2" fill="#f2f2f2"/>`;
        case 'boots':   return `<path d="M35 204h21v28H29c0-6 3-10 6-10zM64 204h21v18c3 0 6 4 6 10H64z" fill="${c}"/><rect x="29" y="231" width="27" height="5" fill="${d}"/><rect x="64" y="231" width="27" height="5" fill="${d}"/><path d="M40 208h10M40 213h10M40 218h10M70 208h10M70 213h10M70 218h10" stroke="${shade(c, .3)}" stroke-width="1.2"/>`;
        case 'hightop': return `<path d="M35 212h21v20H30c0-6 2-10 5-10zM64 212h21v10c3 0 5 4 5 10H64z" fill="${c}"/><path d="M30 228h12v4H30zM78 228h12v4H78z" fill="#f2f2f2"/><rect x="29" y="231" width="27" height="5" rx="2" fill="#f2f2f2"/><rect x="64" y="231" width="27" height="5" rx="2" fill="#f2f2f2"/><circle cx="46" cy="218" r="3" fill="${d}"/><circle cx="74" cy="218" r="3" fill="${d}"/>`;
        case 'sandal':  return `<path d="M34 224h22v8H30c0-5 2-8 4-8zM64 224h22c2 0 4 3 4 8H64z" fill="${SKIN}"/><rect x="29" y="231" width="27" height="4" rx="2" fill="${d}"/><rect x="64" y="231" width="27" height="4" rx="2" fill="${d}"/><path d="M34 227h20M66 227h20" stroke="${c}" stroke-width="3"/>`;
      }
      return '';
    }
  };

  function render(outfit, viewBox = '0 0 120 250') {
    const o = outfit;
    const col = slot => D.palette[o[slot][1]];
    return `<svg viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg">
      ${parts.hatBack(o.hat[0], col('hat'))}
      ${parts.topBack(o.top[0], col('top'))}
      <rect x="36" y="128" width="20" height="100" fill="${SKIN}"/><rect x="64" y="128" width="20" height="100" fill="${SKIN}"/>
      <rect x="19" y="68" width="13" height="74" rx="6" fill="${SKIN}"/><rect x="88" y="68" width="13" height="74" rx="6" fill="${SKIN}"/>
      <circle cx="25" cy="146" r="7" fill="${SKIN}"/><circle cx="95" cy="146" r="7" fill="${SKIN}"/>
      <rect x="53" y="50" width="14" height="12" fill="${SKIN_D}"/>
      <path d="M36 62h48l2 70H34z" fill="${SKIN}"/>
      ${parts.bottom(o.bottom[0], col('bottom'))}
      ${parts.shoes(o.shoes[0], col('shoes'))}
      ${parts.top(o.top[0], col('top'))}
      <ellipse cx="60" cy="36" rx="19" ry="21" fill="${SKIN}"/>
      <circle cx="53" cy="37" r="2" fill="#2a2a2a"/><circle cx="67" cy="37" r="2" fill="#2a2a2a"/>
      <path d="M55 47c3 2 7 2 10 0" fill="none" stroke="${SKIN_D}" stroke-width="1.6" stroke-linecap="round"/>
      ${parts.hat(o.hat[0], col('hat'))}
      ${parts.acc(o.acc[0], col('acc'))}
    </svg>`;
  }

  /* 파츠 썸네일: 같은 렌더러를 부위만 잘라서 사용 */
  const thumbBox = { hat: '28 4 64 62', top: '12 48 96 100', bottom: '24 124 72 110', shoes: '24 198 72 42', acc: '28 8 64 64' };
  function thumb(slot, itemId, colorIdx, base) {
    const o = JSON.parse(JSON.stringify(base));
    o[slot] = [itemId, colorIdx];
    const box = slot === 'acc' && itemId === 'pack' ? '24 48 72 76' : thumbBox[slot];
    return render(o, box);
  }

  function randomOutfit() {
    const o = {};
    Object.keys(D.parts).forEach(slot => { o[slot] = [LF.pick(D.parts[slot].items)[0], LF.randInt(0, D.palette.length - 1)]; });
    return o;
  }

  LF.character = { render, thumb, randomOutfit };
})();
