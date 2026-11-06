import type { StreamServer } from "./streamProvider";

export const KNOWN_STREAM_MAP: Record<number, Record<number, { url: string; quality: string }>> = {
  // MAL 3470: S.A: Special A (24 Episodes)
  3470: {
  "1": {
    "url": "https://vixcloud.cc/playlist/136631?type=video&rendition=360p&token=TFdGWw-85q9Fsxjt4r1CYw&expires=1799113318&edge=au-u2-01",
    "quality": "360p"
  },
  "2": {
    "url": "https://vixcloud.cc/playlist/136760?type=video&rendition=360p&token=J48npGnFMrXieL23lsFPgg&expires=1799113319&edge=au-u1-01",
    "quality": "360p"
  },
  "3": {
    "url": "https://vixcloud.cc/playlist/136632?type=video&rendition=360p&token=hkJNIVuRL12UPf1fhAeGCA&expires=1799113322&edge=au-u3-01",
    "quality": "360p"
  },
  "4": {
    "url": "https://vixcloud.cc/playlist/136633?type=video&rendition=360p&token=phmygZNs6aZaqpntTyUhVw&expires=1799113324&edge=au-u3-01",
    "quality": "360p"
  },
  "5": {
    "url": "https://vixcloud.cc/playlist/136636?type=video&rendition=360p&token=qZEzUSBcnwn1d6XqALaKjg&expires=1799113325&edge=au-u3-01",
    "quality": "360p"
  },
  "6": {
    "url": "https://vixcloud.cc/playlist/136635?type=video&rendition=360p&token=8YhqDMNA0-EkQGK3dLWAOA&expires=1799113327&edge=au-u2-01",
    "quality": "360p"
  },
  "7": {
    "url": "https://vixcloud.cc/playlist/136637?type=video&rendition=360p&token=TkjdPsXjTsgUkxqEn3IAiQ&expires=1799113329&edge=au-u3-01",
    "quality": "360p"
  },
  "8": {
    "url": "https://vixcloud.cc/playlist/136640?type=video&rendition=360p&token=0FSZiWQTOXmmrbcWxEA4-w&expires=1799113331&edge=au-u2-01",
    "quality": "360p"
  },
  "9": {
    "url": "https://vixcloud.cc/playlist/136638?type=video&rendition=360p&token=yURQsl2lY6pGv8Jev2YaIQ&expires=1799113333&edge=au-u3-01",
    "quality": "360p"
  },
  "10": {
    "url": "https://vixcloud.cc/playlist/136641?type=video&rendition=360p&token=Sf8KjaoIvZqt4TC-E_r79Q&expires=1799113335&edge=au-u3-01",
    "quality": "360p"
  },
  "11": {
    "url": "https://vixcloud.cc/playlist/136644?type=video&rendition=360p&token=wX9RKdfiFNmY84BhCne41g&expires=1799113337&edge=au-u2-01",
    "quality": "360p"
  },
  "12": {
    "url": "https://vixcloud.cc/playlist/136642?type=video&rendition=360p&token=kyR-R9NIJmiXm3-u-KS9AQ&expires=1799113339&edge=au-u2-01",
    "quality": "360p"
  },
  "13": {
    "url": "https://vixcloud.cc/playlist/136645?type=video&rendition=360p&token=je73LQAkmmJu9oQlLs4esQ&expires=1799113341&edge=au-u2-01",
    "quality": "360p"
  },
  "14": {
    "url": "https://vixcloud.cc/playlist/136643?type=video&rendition=360p&token=LHFk8mgKhMvUOzB4XaEz3g&expires=1799113343&edge=au-u3-01",
    "quality": "360p"
  },
  "15": {
    "url": "https://vixcloud.cc/playlist/136639?type=video&rendition=360p&token=6XPWFGGWp4r58E8eZh9ALQ&expires=1799113344&edge=au-u3-01",
    "quality": "360p"
  },
  "16": {
    "url": "https://vixcloud.cc/playlist/136648?type=video&rendition=360p&token=8_LrWDyVQ9x0Wdw1dhcgBQ&expires=1799113346&edge=au-u1-01",
    "quality": "360p"
  },
  "17": {
    "url": "https://vixcloud.cc/playlist/136647?type=video&rendition=360p&token=yOgEaxgedK_ULbgiQFckGQ&expires=1799113348&edge=au-u1-01",
    "quality": "360p"
  },
  "18": {
    "url": "https://vixcloud.cc/playlist/136650?type=video&rendition=360p&token=tQS8sv8yDpYTqYRKwszC4w&expires=1799113350&edge=au-u1-01",
    "quality": "360p"
  },
  "19": {
    "url": "https://vixcloud.cc/playlist/136652?type=video&rendition=360p&token=KVjCVk5Ej43LdDexCBTc5Q&expires=1799113352&edge=au-u2-01",
    "quality": "360p"
  },
  "20": {
    "url": "https://vixcloud.cc/playlist/136653?type=video&rendition=360p&token=s8V1_QgdyPFerSaHunlDbw&expires=1799113354&edge=au-u1-01",
    "quality": "360p"
  },
  "21": {
    "url": "https://vixcloud.cc/playlist/136649?type=video&rendition=360p&token=-SgrBgxWlG1dM0y-VpiDkw&expires=1799113355&edge=au-u2-01",
    "quality": "360p"
  },
  "22": {
    "url": "https://vixcloud.cc/playlist/136651?type=video&rendition=360p&token=BpwOmDN_K0TAcKPw0kE2cw&expires=1799113357&edge=au-u1-01",
    "quality": "360p"
  },
  "23": {
    "url": "https://vixcloud.cc/playlist/136646?type=video&rendition=360p&token=KIbBscYSB9zG6FmP7bF2-A&expires=1799113359&edge=au-u3-01",
    "quality": "360p"
  },
  "24": {
    "url": "https://vixcloud.cc/playlist/136654?type=video&rendition=360p&token=1aSbT5H5p60rx5NiauEaQQ&expires=1799113361&edge=au-u1-01",
    "quality": "360p"
  }
}
};

export function getKnownStreams(animeId: number, episode: number): StreamServer[] | null {
  const animeEntry = KNOWN_STREAM_MAP[animeId];
  if (!animeEntry) return null;
  const epEntry = animeEntry[episode];
  if (!epEntry) return null;

  const servers: StreamServer[] = [
    {
      id: `stellar-sub-${animeId}-${episode}`,
      name: "Stellar HD",
      category: "SUB",
      url: epEntry.url,
      type: "hls",
      quality: epEntry.quality || "360p",
      subtitles: [],
    },
    {
      id: `stellar-sub-proxied-${animeId}-${episode}`,
      name: "Stellar HD (Proxy)",
      category: "SUB",
      url: `/api/stream/proxy?url=${encodeURIComponent(epEntry.url)}&referer=${encodeURIComponent("https://www.animeunity.to/")}`,
      type: "hls",
      quality: epEntry.quality || "360p",
      subtitles: [],
    }
  ];

  if (animeId === 3470 && episode === 1) {
    servers.push({
      id: "stellar-dub-3470-1",
      name: "Stellar HD (Dub)",
      category: "DUB",
      url: "https://vixcloud.cc/playlist/136821?type=video&rendition=1080p&token=c50nuW7GLYnPrjII0WjeIw&expires=1799112823&edge=au-u3-01",
      type: "hls",
      quality: "1080p",
      subtitles: [],
    });
  }

  return servers;
}
