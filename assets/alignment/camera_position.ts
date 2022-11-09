import * as cc from "cc";

/** 摄像机定位 */
class camera_position {
	constructor(init_: camera_position_.init_config) {
		this._init_data = new camera_position_.init_config(init_);

		// 定位图
		this._img = cv.imread(this._init_data.img.data);

		// 初始化灰度图
		cv.cvtColor(this._img, this._img_gray, cv.COLOR_BGRA2GRAY);
		// 初始化关键点和描述符
		this._extract_features(this._img_gray, this._img_key_points, this._img_descriptors);
	}
	/* --------------- private --------------- */
	private _init_data!: camera_position_.init_config;
	/** 定位图 */
	private _img: any;
	/** 定位图灰度 */
	private _img_gray = new cv.Mat();
	/** 参考图关键点 */
	private _img_key_points = new cv.KeyPointVector();
	/** 定位图描述符 */
	private _img_descriptors = new cv.Mat();
	/** 匹配结果筛选 */
	private _match_result = new cv.DMatchVector();
	/* ------------------------------- 功能 ------------------------------- */
	/**
	 * 关键点检测 & 特征提取
	 * @param feature_
	 * @param img_
	 * @param key_points_
	 * @param descriptors_
	 */
	private _extract_features(img_: any, key_points_: any, descriptors_: any): boolean {
		// 检查关键点
		this._init_data.detector.detect(img_, key_points_);
		if (!key_points_.size()) {
			return false;
		}
		// 计算描述符
		this._init_data.extractor.compute(img_, key_points_, descriptors_);
		if (!descriptors_.empty()) {
			return false;
		}

		return true;
	}

	/** 获取匹配结果 */
	private _get_matches(): void {
		// 清空结果数据
		this._match_result.clear();
	}
}

export namespace camera_position_ {
	export class init_config {
		constructor(init_?: init_config) {
			Object.assign(this, init_);
		}
		/** 定位图 */
		img!: cc.ImageAsset;
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
