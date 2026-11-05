export interface AnimeAvatar {
  id: string;
  name: string;
  character: string;
  series: string;
  category: "Studio Ghibli" | "Anime Chibi";
  url: string;
}

export const ANIME_AVATARS: AnimeAvatar[] = [
  // Studio Ghibli
  {
    id: "totoro",
    name: "Totoro",
    character: "Totoro",
    series: "My Neighbor Totoro",
    category: "Studio Ghibli",
    url: "/avatars/totoro.svg",
  },
  {
    id: "calcifer",
    name: "Calcifer",
    character: "Calcifer",
    series: "Howl's Moving Castle",
    category: "Studio Ghibli",
    url: "/avatars/calcifer.svg",
  },
  {
    id: "jiji",
    name: "Jiji",
    character: "Jiji the Cat",
    series: "Kiki's Delivery Service",
    category: "Studio Ghibli",
    url: "/avatars/jiji.svg",
  },
  {
    id: "soot-sprite",
    name: "Soot Sprite",
    character: "Susuwatari",
    series: "Spirited Away",
    category: "Studio Ghibli",
    url: "/avatars/soot-sprite.svg",
  },
  {
    id: "no-face",
    name: "No-Face",
    character: "Kaonashi",
    series: "Spirited Away",
    category: "Studio Ghibli",
    url: "/avatars/no-face.svg",
  },
  {
    id: "ponyo",
    name: "Ponyo",
    character: "Ponyo",
    series: "Ponyo on the Cliff",
    category: "Studio Ghibli",
    url: "/avatars/ponyo.svg",
  },
  {
    id: "kodama",
    name: "Kodama",
    character: "Tree Spirit",
    series: "Princess Mononoke",
    category: "Studio Ghibli",
    url: "/avatars/kodama.svg",
  },
  {
    id: "kiki",
    name: "Kiki",
    character: "Kiki",
    series: "Kiki's Delivery Service",
    category: "Studio Ghibli",
    url: "/avatars/kiki.svg",
  },
  {
    id: "catbus",
    name: "Catbus",
    character: "Nekobasu",
    series: "My Neighbor Totoro",
    category: "Studio Ghibli",
    url: "/avatars/catbus.svg",
  },

  // Anime Chibis
  {
    id: "anya",
    name: "Anya Forger",
    character: "Anya",
    series: "Spy x Family",
    category: "Anime Chibi",
    url: "/avatars/anya.svg",
  },
  {
    id: "chopper",
    name: "Tony Tony Chopper",
    character: "Chopper",
    series: "One Piece",
    category: "Anime Chibi",
    url: "/avatars/chopper.svg",
  },
  {
    id: "pochita",
    name: "Pochita",
    character: "Pochita",
    series: "Chainsaw Man",
    category: "Anime Chibi",
    url: "/avatars/pochita.svg",
  },
  {
    id: "nezuko",
    name: "Nezuko Kamado",
    character: "Nezuko",
    series: "Demon Slayer",
    category: "Anime Chibi",
    url: "/avatars/nezuko.svg",
  },
  {
    id: "frieren",
    name: "Frieren",
    character: "Frieren",
    series: "Frieren: Beyond Journey's End",
    category: "Anime Chibi",
    url: "/avatars/frieren.svg",
  },
  {
    id: "pikachu",
    name: "Pikachu",
    character: "Pikachu",
    series: "Pokémon",
    category: "Anime Chibi",
    url: "/avatars/pikachu.svg",
  },
  {
    id: "luna",
    name: "Luna",
    character: "Luna the Cat",
    series: "Sailor Moon",
    category: "Anime Chibi",
    url: "/avatars/luna.svg",
  },
  {
    id: "gojo",
    name: "Satoru Gojo",
    character: "Gojo",
    series: "Jujutsu Kaisen",
    category: "Anime Chibi",
    url: "/avatars/gojo.svg",
  },
];

export const DEFAULT_AVATAR = "/avatars/totoro.svg";

export function getAvatarByUrl(url?: string | null): AnimeAvatar | undefined {
  if (!url) return undefined;
  return ANIME_AVATARS.find((a) => a.url === url || url.includes(a.id));
}
