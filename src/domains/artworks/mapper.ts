import type {
  ArtistTypeFilterOption,
  ArtworkArchiveItem,
  ArtworkCard,
  ArtworkDetail,
  ArtworkFiltersResponse,
  ArtworkFiltersV2Response,
  ArtworkImage,
  ArtworkLikeResponse,
  ArtworkListResponse,
  PlaceFilterSourceRow,
  ZonePlaceFilterOption,
  ZonePlaceV2FilterOption,
} from './types.js';

const ARTIST_TYPE_FILTER_OPTIONS: ArtistTypeFilterOption[] = [
  {
    label_en: 'Company',
    label_ko: '단체',
    value: 'COMPANY',
  },
  {
    label_en: 'Individual',
    label_ko: '개인',
    value: 'INDIVIDUAL',
  },
];

export function mapArtworkCard(card: ArtworkCard): ArtworkCard {
  return {
    artist_name_en: card.artist_name_en,
    artist_name_ko: card.artist_name_ko,
    id: card.id,
    lat: card.lat,
    liked: card.liked,
    lng: card.lng,
    place_name_en: card.place_name_en,
    place_name_ko: card.place_name_ko,
    thumbnail_image_url: card.thumbnail_image_url,
    title_en: card.title_en,
    title_ko: card.title_ko,
    zone_id: card.zone_id,
  };
}

export function mapArtworkArchiveItem(item: ArtworkArchiveItem): ArtworkArchiveItem {
  return {
    address: item.address,
    address_en: item.address_en,
    artist_name_en: item.artist_name_en,
    artist_name_ko: item.artist_name_ko,
    id: item.id,
    liked: item.liked,
    place_name_en: item.place_name_en,
    place_name_ko: item.place_name_ko,
    thumbnail_image_height: item.thumbnail_image_height,
    thumbnail_image_url: item.thumbnail_image_url,
    thumbnail_image_width: item.thumbnail_image_width,
    title_en: item.title_en,
    title_ko: item.title_ko,
  };
}

export function mapArtworkListResponse(
  artworks: ArtworkArchiveItem[],
  page: number,
  size: number,
  total: number,
): ArtworkListResponse {
  return {
    artworks: artworks.map(mapArtworkArchiveItem),
    page,
    size,
    total,
  };
}

export function mapArtworkLikeResponse(artworkId: number, liked: boolean): ArtworkLikeResponse {
  return {
    artworkId,
    liked,
  };
}

export function mapArtworkImage(image: ArtworkImage): ArtworkImage {
  return {
    image_height: image.image_height,
    image_url: image.image_url,
    image_width: image.image_width,
  };
}

export function mapArtworkDetail(detail: ArtworkDetail): ArtworkDetail {
  return {
    address: detail.address,
    address_en: detail.address_en,
    artist_name_en: detail.artist_name_en,
    artist_name_ko: detail.artist_name_ko,
    audio_url_en: detail.audio_url_en,
    audio_url_ko: detail.audio_url_ko,
    category: detail.category,
    description_en: detail.description_en,
    description_ko: detail.description_ko,
    festival_years: [...detail.festival_years],
    id: detail.id,
    images: detail.images.map(mapArtworkImage),
    lat: detail.lat,
    liked: detail.liked,
    lng: detail.lng,
    material: detail.material,
    place_name_en: detail.place_name_en,
    place_name_ko: detail.place_name_ko,
    production_year: detail.production_year,
    size_text_en: detail.size_text_en,
    size_text_ko: detail.size_text_ko,
    title_en: detail.title_en,
    title_ko: detail.title_ko,
    zone_id: detail.zone_id,
    zone_name_en: detail.zone_name_en,
    zone_name_ko: detail.zone_name_ko,
  };
}

export function mapArtworkFiltersResponse(
  zones: ZonePlaceFilterOption[],
  festivalYears: string[],
): ArtworkFiltersResponse {
  return {
    artistTypes: ARTIST_TYPE_FILTER_OPTIONS.map((option) => ({
      label_en: option.label_en,
      label_ko: option.label_ko,
      value: option.value,
    })),
    festivalYears: [...festivalYears],
    zones: zones.map((zone) => ({
      id: zone.id,
      name_en: zone.name_en,
      name_ko: zone.name_ko,
      places: zone.places.map((place) => ({
        id: place.id,
        name_en: place.name_en,
        name_ko: place.name_ko,
      })),
    })),
  };
}

export function mapArtworkFiltersV2Response(
  placeRows: PlaceFilterSourceRow[],
  festivalYears: string[],
): { nameEnConflicts: string[]; response: ArtworkFiltersV2Response } {
  const zones: ZonePlaceV2FilterOption[] = [];
  const nameEnConflicts: string[] = [];

  for (const row of placeRows) {
    let zone = zones.find((candidate) => candidate.id === row.zone_id);

    if (!zone) {
      zone = {
        id: row.zone_id,
        name_en: row.zone_name_en,
        name_ko: row.zone_name_ko,
        places: [],
      };
      zones.push(zone);
    }

    let place = zone.places.find((candidate) => candidate.name_ko === row.place_name_ko);

    if (!place) {
      place = {
        name_en: row.place_name_en,
        name_ko: row.place_name_ko,
        placeIds: [],
      };
      zone.places.push(place);
    } else if (row.place_name_en !== place.name_en) {
      // 같은 name_ko 그룹에 영문명이 갈리면: 대표값은 사전순 MIN으로 결정적 선택 + 충돌 기록.
      if (!nameEnConflicts.includes(row.place_name_ko)) {
        nameEnConflicts.push(row.place_name_ko);
      }

      if (row.place_name_en < place.name_en) {
        place.name_en = row.place_name_en;
      }
    }

    if (!place.placeIds.includes(row.place_id)) {
      place.placeIds.push(row.place_id);
    }
  }

  for (const zone of zones) {
    for (const place of zone.places) {
      place.placeIds.sort((left, right) => left - right);
    }
  }

  return {
    nameEnConflicts,
    response: {
      artistTypes: ARTIST_TYPE_FILTER_OPTIONS.map((option) => ({
        label_en: option.label_en,
        label_ko: option.label_ko,
        value: option.value,
      })),
      festivalYears: [...festivalYears],
      zones,
    },
  };
}
