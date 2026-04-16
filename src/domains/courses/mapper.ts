import type {
  CourseCheckinResponse,
  CourseDetail,
  CourseDetailItem,
  CourseLikeResponse,
  CourseListItem,
  CourseListResponse,
} from './types.js';

export function mapCourseListItem(course: CourseListItem): CourseListItem {
  return {
    description_en: course.description_en,
    description_ko: course.description_ko,
    end_place_name_en: course.end_place_name_en,
    end_place_name_ko: course.end_place_name_ko,
    id: course.id,
    is_official: course.is_official,
    liked: course.liked,
    stamped: course.stamped,
    start_place_name_en: course.start_place_name_en,
    start_place_name_ko: course.start_place_name_ko,
    thumbnail_image_height: course.thumbnail_image_height,
    thumbnail_image_url: course.thumbnail_image_url,
    thumbnail_image_width: course.thumbnail_image_width,
    title_en: course.title_en,
    title_ko: course.title_ko,
  };
}

export function mapCourseListResponse(
  courses: CourseListItem[],
  page: number,
  size: number,
  total: number,
): CourseListResponse {
  return {
    courses: courses.map(mapCourseListItem),
    page,
    size,
    total,
  };
}

export function mapCourseDetailItem(item: CourseDetailItem): CourseDetailItem {
  return {
    artwork_id: item.artwork_id,
    artist_name_en: item.artist_name_en,
    artist_name_ko: item.artist_name_ko,
    checkedIn: item.checkedIn,
    id: item.id,
    lat: item.lat,
    lng: item.lng,
    place_name_en: item.place_name_en,
    place_name_ko: item.place_name_ko,
    seq: item.seq,
    thumbnail_image_height: item.thumbnail_image_height,
    thumbnail_image_url: item.thumbnail_image_url,
    thumbnail_image_width: item.thumbnail_image_width,
    title_en: item.title_en,
    title_ko: item.title_ko,
  };
}

export function mapCourseDetail(detail: CourseDetail): CourseDetail {
  return {
    description_en: detail.description_en,
    description_ko: detail.description_ko,
    editable: detail.editable,
    id: detail.id,
    is_official: detail.is_official,
    items: detail.items.map(mapCourseDetailItem),
    liked: detail.liked,
    stamped: detail.stamped,
    title_en: detail.title_en,
    title_ko: detail.title_ko,
  };
}

export function mapCourseLikeResponse(courseId: number, liked: boolean): CourseLikeResponse {
  return {
    courseId,
    liked,
  };
}

export function mapCourseCheckinResponse(
  courseId: number,
  courseItemId: number,
): CourseCheckinResponse {
  return {
    checkedIn: true,
    courseId,
    courseItemId,
    stamped: true,
  };
}
