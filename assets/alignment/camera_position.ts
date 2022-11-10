import * as cc from "cc";

namespace _camera_position {
	/** 图片类型 */
	export type img_t = HTMLCanvasElement | HTMLImageElement;

	/** 图片数据 */
	export class img_date {
		/** 图 */
		img: any;
		/** 灰度图 */
		img_gray = new cv.Mat();
		/** 关键点 */
		key_points = new cv.KeyPointVector();
		/** 描述符 */
		descriptors = new cv.Mat();

		reset(img_: img_t, detector_: any, extractor_: any): void {
			this._clear();
			// 图
			this.img = cv.imread(img_);
			// 灰度图
			cv.cvtColor(this.img, this.img_gray, cv.COLOR_BGRA2GRAY);
			// 关键点检测 & 特征提取
			this._extract_features(detector_, extractor_);
		}

		/**
		 * 关键点检测 & 特征提取
		 */
		private _extract_features(detector_: any, extractor_: any): boolean {
			// 检查关键点
			detector_.detect(this.img_gray, this.key_points);
			if (!this.key_points.size()) {
				return false;
			}
			// 计算描述符
			extractor_.compute(this.img_gray, this.key_points, this.descriptors);
			if (this.descriptors.empty()) {
				return false;
			}
			cc.log(" 关键点数量 ", this.key_points.size());
			return true;
		}

		/** 清理 */
		private _clear(): void {}
	}
}

/** 摄像机定位 */
class camera_position {
	constructor(init_: camera_position_.init_config) {
		this._init_data = new camera_position_.init_config(init_);
		// 初始化定位图
		this._img.reset(this._init_data.img, this._init_data.detector, this._init_data.extractor);
	}
	/* --------------- private --------------- */
	private _init_data!: camera_position_.init_config;
	/** 定位图 */
	private _img = new _camera_position.img_date();
	/** 临时图 */
	private _img_temp = new _camera_position.img_date();
	/** 匹配结果筛选 */
	private _match_result_filter = new cv.DMatchVector();
	/** 匹配结果 */
	private _match_result = new cv.DMatchVectorVector();
	/* ------------------------------- 功能 ------------------------------- */
	match(img_: _camera_position.img_t): void {
		// 初始化图
		this._img_temp.reset(img_, this._init_data.detector, this._init_data.extractor);
		// 获取匹配结果
		this._get_matches();

		let mat = new cv.Mat();
		this.refineMatchesWithHomography(
			this._img.key_points,
			this._img_temp.key_points,
			3,
			this._match_result_filter,
			mat
		);
		// https://ahmetozlu.medium.com/marker-less-augmented-reality-by-opencv-and-opengl-531b2af0a130
		// https://raw.githubusercontent.com/ahmetozlu/open_source_markerless_augmented_reality/master/MarkerlessAR_V2/src/PatternDetector.cpp
	}

	refineMatchesWithHomography(
		queryKeypoints,
		trainKeypoints,
		reprojectionThreshold: number,
		matches,
		homography
	): boolean {
		const minNumberMatchesAllowed = 8;
		if (matches.size() < minNumberMatchesAllowed) return false;
		// // Prepare data for cv::findHomography
		let srcPoints: { x: number; y: number }[] = [];
		let dstPoints: { x: number; y: number }[] = [];
		for (let i = 0; i < matches.size(); i++) {
			srcPoints[i] = trainKeypoints[matches[i].trainIdx].pt;
			dstPoints[i] = queryKeypoints[matches[i].queryIdx].pt;
		}
		// // Find homography matrix and get inliers mask
		let inliersMask = [];
		homography = cv.findHomography(
			srcPoints,
			dstPoints,
			cv.CV_FM_RANSAC,
			reprojectionThreshold,
			inliersMask
		);
		let inliers = new cv.DMatchVector();
		for (let i = 0; i < inliersMask.length; i++) {
			if (inliersMask[i]) inliers.push_back(matches[i]);
		}
		matches.swap(inliers);
		return matches.size() > minNumberMatchesAllowed;
	}

	/** 获取匹配结果 */
	private _get_matches(): void {
		// 蛮力匹配
		if (this._init_data.match_ratio !== undefined) {
			this._init_data.matcher.knnMatch(
				this._img.descriptors,
				this._img_temp.descriptors,
				this._match_result,
				2
			);
			for (let k_n = 0, len_n = this._match_result.size(); k_n < len_n; ++k_n) {
				let match = this._match_result.get(k_n);
				let point = match.get(0);
				let point2 = match.get(1);
				if (point.distance <= point2.distance * this._init_data.match_ratio) {
					this._match_result_filter.push_back(point);
				}
			}
		} else {
			this._init_data.matcher.match(this._img_temp.descriptors, this._match_result_filter);
		}
	}
}

export namespace camera_position_ {
	export class init_config {
		constructor(init_?: init_config) {
			Object.assign(this, init_);
		}
		/** 定位图 */
		img!: _camera_position.img_t;
		/** 关键点检测器 */
		detector: any;
		/** 特征提取器 */
		extractor: any;
		/** 匹配器 */
		matcher: any;
		/** 匹配比率（越小越精准，一般为 0.7，不填则不使用 knnMatch） */
		match_ratio?: number;
	}
}

export default camera_position;
