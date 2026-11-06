import type { StreamServer } from "./streamProvider";

export const KNOWN_STREAM_MAP: Record<number, Record<number, { url: string; quality: string }>> = {
  // MAL 3470: S.A: Special A (24 Episodes, 360p)
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
},
  // MAL 1562: The Wallflower / Yamato Nadeshiko Shichihenge (25 Episodes, 480p)
  1562: {
  "1": {
    "url": "https://vixcloud.cc/playlist/144855?type=video&rendition=480p&token=IqKLmlA3QnAsZ-jhRp4E5A&expires=1799113913&edge=au-u1-01",
    "quality": "480p"
  },
  "2": {
    "url": "https://vixcloud.cc/playlist/144857?type=video&rendition=480p&token=cmC_Ieo9SqGL51SNdlKZTg&expires=1799113915&edge=au-u3-01",
    "quality": "480p"
  },
  "3": {
    "url": "https://vixcloud.cc/playlist/144856?type=video&rendition=480p&token=fDMBSAJqIOzOiA0Tp8chqg&expires=1799113918&edge=au-u1-01",
    "quality": "480p"
  },
  "4": {
    "url": "https://vixcloud.cc/playlist/144860?type=video&rendition=480p&token=JnpDiEslGiyG3HEr8X9J4w&expires=1799113920&edge=au-u2-01",
    "quality": "480p"
  },
  "5": {
    "url": "https://vixcloud.cc/playlist/144861?type=video&rendition=480p&token=MdhsbefUg4hDwPZV1otwGQ&expires=1799113922&edge=au-u2-01",
    "quality": "480p"
  },
  "6": {
    "url": "https://vixcloud.cc/playlist/144863?type=video&rendition=480p&token=H1MU5H93h83v_w6_THUDag&expires=1799113924&edge=au-u1-01",
    "quality": "480p"
  },
  "7": {
    "url": "https://vixcloud.cc/playlist/144858?type=video&rendition=480p&token=-KJHivRYlNW5cQ3M6dqh-A&expires=1799113926&edge=au-u1-01",
    "quality": "480p"
  },
  "8": {
    "url": "https://vixcloud.cc/playlist/144864?type=video&rendition=480p&token=neUvyRyiNTpTXQfIL3ChUA&expires=1799113928&edge=au-u3-01",
    "quality": "480p"
  },
  "9": {
    "url": "https://vixcloud.cc/playlist/144865?type=video&rendition=480p&token=KDaf3GqH5uP1uelYutDySQ&expires=1799113930&edge=au-u1-01",
    "quality": "480p"
  },
  "10": {
    "url": "https://vixcloud.cc/playlist/144862?type=video&rendition=480p&token=_bXsyvNaZ2KV0YwWtLgQwA&expires=1799113932&edge=au-u3-01",
    "quality": "480p"
  },
  "11": {
    "url": "https://vixcloud.cc/playlist/144859?type=video&rendition=480p&token=NMIA4TmWhGl7rW9Rt01YhQ&expires=1799113935&edge=au-u2-01",
    "quality": "480p"
  },
  "12": {
    "url": "https://vixcloud.cc/playlist/144870?type=video&rendition=480p&token=1VDVw9Ja7nctGRoakg5ovA&expires=1799113937&edge=au-u1-01",
    "quality": "480p"
  },
  "13": {
    "url": "https://vixcloud.cc/playlist/144866?type=video&rendition=480p&token=EwEHmJvRxDf4EKWQR_FDIA&expires=1799113939&edge=au-u3-01",
    "quality": "480p"
  },
  "14": {
    "url": "https://vixcloud.cc/playlist/144867?type=video&rendition=480p&token=ajHrb9rJlM7VvHt4rIUn6w&expires=1799113941&edge=au-u2-01",
    "quality": "480p"
  },
  "15": {
    "url": "https://vixcloud.cc/playlist/144871?type=video&rendition=480p&token=SUbfmy6WS8e3UwRiUUmt5g&expires=1799113943&edge=au-u2-01",
    "quality": "480p"
  },
  "16": {
    "url": "https://vixcloud.cc/playlist/144868?type=video&rendition=480p&token=rVXphuujNQ6uV9PJzGoqRA&expires=1799113945&edge=au-u3-01",
    "quality": "480p"
  },
  "17": {
    "url": "https://vixcloud.cc/playlist/144872?type=video&rendition=480p&token=_gnxXKYM-AlZSqg7HzWqIw&expires=1799113947&edge=au-u2-01",
    "quality": "480p"
  },
  "18": {
    "url": "https://vixcloud.cc/playlist/144869?type=video&rendition=480p&token=TQcFLUAHs3jxfpUWSnbj2g&expires=1799113949&edge=au-u1-01",
    "quality": "480p"
  },
  "19": {
    "url": "https://vixcloud.cc/playlist/144873?type=video&rendition=480p&token=OGdowqSbEr_fn5bX0nkcbA&expires=1799113951&edge=au-u1-01",
    "quality": "480p"
  },
  "20": {
    "url": "https://vixcloud.cc/playlist/144874?type=video&rendition=480p&token=bNPCqD8aDS-dlkXnAR_58A&expires=1799113953&edge=au-u2-01",
    "quality": "480p"
  },
  "21": {
    "url": "https://vixcloud.cc/playlist/144875?type=video&rendition=480p&token=tzwryd1vIoMXI8kIpD9rYw&expires=1799113955&edge=au-u3-01",
    "quality": "480p"
  },
  "22": {
    "url": "https://vixcloud.cc/playlist/144877?type=video&rendition=480p&token=_pSPYut35Xqn_PvGgulZmg&expires=1799113957&edge=au-u3-01",
    "quality": "480p"
  },
  "23": {
    "url": "https://vixcloud.cc/playlist/144878?type=video&rendition=480p&token=R4z9abVRpgv4A_exDNv4Cg&expires=1799113959&edge=au-u3-01",
    "quality": "480p"
  },
  "24": {
    "url": "https://vixcloud.cc/playlist/144876?type=video&rendition=480p&token=fTwMwf0K8CkxeNMwKV9Dig&expires=1799113961&edge=au-u3-01",
    "quality": "480p"
  },
  "25": {
    "url": "https://vixcloud.cc/playlist/144879?type=video&rendition=480p&token=v68C6pThi10Tv_0Q1OB-7g&expires=1799113963&edge=au-u3-01",
    "quality": "480p"
  }
}
};

export function getKnownStreams(animeId: number, episode: number): StreamServer[] | null {
  const animeEntry = KNOWN_STREAM_MAP[animeId];
  if (!animeEntry) return null;
  const epEntry = animeEntry[episode];
  if (!epEntry) return null;

  const detectedQuality = epEntry.quality || "480p";

  const servers: StreamServer[] = [
    {
      id: `stellar-sub-${animeId}-${episode}`,
      name: "Stellar HD",
      category: "SUB",
      url: epEntry.url,
      type: "hls",
      quality: detectedQuality,
      subtitles: [],
    },
    {
      id: `stellar-sub-proxied-${animeId}-${episode}`,
      name: "Stellar HD (Proxy)",
      category: "SUB",
      url: `/api/stream/proxy?url=${encodeURIComponent(epEntry.url)}&referer=${encodeURIComponent("https://www.animeunity.to/")}`,
      type: "hls",
      quality: detectedQuality,
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
