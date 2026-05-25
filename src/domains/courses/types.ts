export const COURSE_LIST_DEFAULT_PAGE = 1;
export const COURSE_LIST_DEFAULT_SIZE = 20;
export const COURSE_LIST_MAX_SIZE = 100;
export const RECENT_COMMUNITY_COURSE_DEFAULT_SIZE = 10;
export const RECENT_COMMUNITY_COURSE_MAX_SIZE = 10;
export const CHECKIN_BASE_RADIUS_METERS = 10;
export const CHECKIN_TOLERANCE_METERS = 5;
export const CHECKIN_ALLOWED_RADIUS_METERS =
  CHECKIN_BASE_RADIUS_METERS + CHECKIN_TOLERANCE_METERS;

export interface CourseListInput {
  page: number;
  size: number;
}

export interface RecentCommunityCourseListInput {
  size: number;
}

export interface StampProgress {
  checkedInCount: number;
  totalCount: number;
}

export interface CourseListItem {
  description_en: string | null;
  description_ko: string | null;
  end_place_name_en: string | null;
  end_place_name_ko: string | null;
  id: number;
  is_official: boolean;
  liked: boolean;
  stampProgress: StampProgress | null;
  start_place_name_en: string | null;
  start_place_name_ko: string | null;
  thumbnail_image_height: number | null;
  thumbnail_image_url: string | null;
  thumbnail_image_width: number | null;
  title_en: string;
  title_ko: string;
}

export interface CourseListResponse {
  courses: CourseListItem[];
  page: number;
  size: number;
  total: number;
}

export interface FavoriteCoursesResponse {
  communityCourses: CourseListItem[];
  officialCourses: CourseListItem[];
}

export interface CourseDetailItem {
  artwork_id: number;
  artist_name_en: string;
  artist_name_ko: string;
  checkedIn: boolean;
  id: number;
  lat: number;
  lng: number;
  place_name_en: string;
  place_name_ko: string;
  seq: number;
  thumbnail_image_height: number | null;
  thumbnail_image_url: string | null;
  thumbnail_image_width: number | null;
  title_en: string;
  title_ko: string;
}

export interface CourseDetail {
  description_en: string | null;
  description_ko: string | null;
  editable: boolean;
  id: number;
  is_official: boolean;
  items: CourseDetailItem[];
  liked: boolean;
  stampProgress: StampProgress | null;
  title_en: string;
  title_ko: string;
}

export interface CourseMutationItemInput {
  artwork_id: number;
  seq: number;
}

export interface CreateCourseInput {
  description_en: string;
  description_ko: string;
  items: CourseMutationItemInput[];
  title_en: string;
  title_ko: string;
}

export interface UpdateCourseInput {
  description_en: string;
  description_ko: string;
  items: CourseMutationItemInput[];
  title_en: string;
  title_ko: string;
}

export interface CourseLikeResponse {
  courseId: number;
  liked: boolean;
}

export interface DeleteCourseResponse {
  courseId: number;
  deleted: true;
}

export interface CourseCheckinInput {
  course_item_id: number;
  lat: number;
  lng: number;
}

export interface CourseCheckinResponse {
  checkedIn: true;
  courseId: number;
  courseItemId: number;
  stampProgress: StampProgress;
}

export interface CourseRecord {
  created_by_user_id: number | null;
  id: number;
  is_official: boolean;
}

export interface CourseCheckinTarget {
  alreadyCheckedIn: boolean;
  lat: number;
  lng: number;
}
