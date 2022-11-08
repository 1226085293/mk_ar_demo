import cv from "@techstark/opencv-js";

/** 摄像机定位 */
class camera_position {
	constructor() {}
}

namespace camera_position {
	export class init_config {
		constructor(init_?: init_config) {
			Object.assign(this, init_);
			cv.fastAtan2;
		}
		/** 关键点检测器 */
		keypoint_detector = new cv.AKAZE();
		/** 特征提取器 */
		feature_extractor = new cv.AKAZE();
	}
}

export default camera_position;
