import * as cc from "cc";

namespace _camera_position {
	/** 图片类型 */
	export type img_t = HTMLCanvasElement | HTMLImageElement;

	/** 图片数据 */
	export class img_data {
		/** 图 */
		img: any;
		/** 灰度图 */
		img_gray: any;
		/** 关键点 */
		key_points: any;
		/** 描述符 */
		descriptors: any;
		/** 测试节点 */
		node?: cc.Node;

		reset(img_: img_t): void {
			// 图
			this.img = cv.imread(img_);
			this.img_gray = new cv.Mat();
			this.key_points = new cv.KeyPointVector();
			this.descriptors = new cv.Mat();
			// 灰度图
			cv.cvtColor(this.img, this.img_gray, cv.COLOR_BGRA2GRAY);
		}

		/** 清理 */
		delete(): void {
			if (!this.img) {
				return;
			}
			// 销毁对象
			this.img.delete();
			this.img_gray.delete();
			this.key_points.delete();
			this.descriptors.delete();

			// 清理标记
			this.img = null;
		}
	}
}

/** 摄像机定位 */
class camera_position {
	constructor(init_: camera_position_.init_config) {
		this._init_data = new camera_position_.init_config(init_);

		// 绘制节点
		this._img.node = this._init_data.node_as![0];
		this._img_temp.node = this._init_data.node_as![1];
	}
	/* --------------- private --------------- */
	private _init_data!: camera_position_.init_config;
	/** 定位图 */
	private _img = new _camera_position.img_data();
	/** 临时图 */
	private _img_temp = new _camera_position.img_data();
	/** 匹配结果 */
	private _match_result: any;
	/** 匹配结果筛选 */
	private _match_result_filter: any;
	/** 单应性矩阵 */
	private _homography: any;
	/** 扭曲图数据 */
	private _image_final_result: any;
	/** 销毁列表 */
	private _delete_as: any[] = [];
	/* ------------------------------- 功能 ------------------------------- */
	/** 清理数据 */
	clear(): void {
		if (!this._match_result) {
			return;
		}
		this._match_result.delete();
		this._match_result_filter.delete();
		this._homography.delete();
		this._image_final_result?.delete();
	}

	match(img_: _camera_position.img_t, output_image: cc.Sprite): void {
		this._match_result = new cv.DMatchVectorVector();
		this._match_result_filter = new cv.DMatchVector();

		console.time("reset");
		// 初始化图
		this._img.reset(this._init_data.img);
		this._img_temp.reset(img_);
		this._delete_as.push(this._img, this._img_temp);
		console.timeEnd("reset");

		// 特征提取
		console.time("_extract_features");
		this._extract_features(this._img);
		this._extract_features(this._img_temp);
		console.timeEnd("_extract_features");

		// 获取匹配结果
		console.time("_update_matching_result");
		this._update_matching_result();
		console.timeEnd("_update_matching_result");

		// 计算单应性矩阵
		console.time("calculate_homography");
		this.calculate_homography();
		console.timeEnd("calculate_homography");

		// 扭曲图像
		console.time("warpPerspective");
		cv.warpPerspective(
			this._img_temp.img,
			(this._image_final_result = new cv.Mat()),
			this._homography,
			this._img.img.size()
		);
		console.timeEnd("warpPerspective");

		// 绘制到 sprite
		{
			let canvas = document.createElement("canvas");
			let sprite_frame = new cc.SpriteFrame();
			let image_asset = new cc.ImageAsset();
			let new_texture = new cc.Texture2D();

			// 绘制到 canvas
			cv.imshow(canvas, this._image_final_result);
			image_asset.reset(canvas);
			new_texture.image = image_asset;
			sprite_frame.texture = new_texture;
			output_image.spriteFrame = sprite_frame;
		}

		this.clear();
		// // https://ahmetozlu.medium.com/marker-less-augmented-reality-by-opencv-and-opengl-531b2af0a130
		// // https://raw.githubusercontent.com/ahmetozlu/open_source_markerless_augmented_reality/master/MarkerlessAR_V2/src/PatternDetector.cpp
	}

	/** 绘制匹配线 */
	private _draw_match_line(): void {
		// 绘制匹配结果
		if (
			this._init_data.graphics &&
			this._init_data.draw_type_n! & camera_position_.draw.match_point
		) {
			let graphics = this._init_data.graphics;

			graphics.moveTo(
				this._img.key_points.get(this._match_result_filter.get(0).queryIdx).pt.x,
				this._img.node!.height -
					this._img.key_points.get(this._match_result_filter.get(0).queryIdx).pt.y
			);
			for (let k_n = 0, len_n = this._match_result_filter.size(); k_n < len_n; ++k_n) {
				// 随机绘制颜色
				graphics.strokeColor = [
					cc.Color.WHITE,
					cc.Color.GRAY,
					cc.Color.BLACK,
					cc.Color.TRANSPARENT,
					cc.Color.RED,
					cc.Color.GREEN,
					cc.Color.BLUE,
					cc.Color.CYAN,
					cc.Color.MAGENTA,
					cc.Color.YELLOW,
				][Math.floor(Math.random() * 9)];
				graphics.lineTo(
					this._img_temp.key_points.get(this._match_result_filter.get(k_n).trainIdx).pt
						.x + this._img.node!.width,
					this._img_temp.node!.height -
						this._img_temp.key_points.get(this._match_result_filter.get(k_n).trainIdx)
							.pt.y
				);
				graphics.stroke();
				if (k_n + 1 < len_n) {
					graphics.moveTo(
						this._img.key_points.get(this._match_result_filter.get(k_n + 1).queryIdx).pt
							.x,
						this._img_temp.node!.height -
							this._img.key_points.get(
								this._match_result_filter.get(k_n + 1).queryIdx
							).pt.y
					);
				}
			}
		}
	}

	/**
	 * 关键点检测 & 特征提取
	 */
	private _extract_features(img_: _camera_position.img_data): boolean {
		// if (img_.key_points.size()) {
		// 	return true;
		// }

		let detector = new this._init_data.detector();
		let extractor = new this._init_data.extractor();
		this._delete_as.push(detector, extractor);

		// 检查关键点
		detector.detect(img_.img_gray, img_.key_points);
		if (!img_.key_points.size()) {
			return false;
		}
		// 计算描述符
		extractor.compute(img_.img_gray, img_.key_points, img_.descriptors);
		if (img_.descriptors.empty()) {
			return false;
		}

		// 绘制关键点
		if (img_.node && this._init_data.draw_type_n! & camera_position_.draw.key_point) {
			/** 绘图组件 */
			let graphics: cc.Graphics = img_.node.getComponentInChildren(cc.Graphics)!;

			// 参考图
			if (!graphics) {
				return true;
			}
			// 开始绘制，y 向下需转换
			for (let k_n = 0, len_n = img_.key_points.size(); k_n < len_n; ++k_n) {
				graphics.moveTo(
					img_.key_points.get(k_n).pt.x,
					img_.node.height - img_.key_points.get(k_n).pt.y
				);
				graphics.circle(
					img_.key_points.get(k_n).pt.x,
					img_.node.height - img_.key_points.get(k_n).pt.y,
					6
				);
				graphics.stroke();
			}
		}
		return true;
	}

	/** 计算单应性矩阵 */
	calculate_homography(): void {
		let src_point_ns: number[] = [];
		let dst_point_ns: number[] = [];
		for (let k_n = 0, len_n = this._match_result_filter.size(); k_n < len_n; ++k_n) {
			src_point_ns.push(
				this._img_temp.key_points.get(this._match_result_filter.get(k_n).trainIdx).pt.x
			);
			src_point_ns.push(
				this._img_temp.key_points.get(this._match_result_filter.get(k_n).trainIdx).pt.y
			);
			dst_point_ns.push(
				this._img.key_points.get(this._match_result_filter.get(k_n).queryIdx).pt.x
			);
			dst_point_ns.push(
				this._img.key_points.get(this._match_result_filter.get(k_n).queryIdx).pt.y
			);
		}
		let src_mat = new cv.Mat(src_point_ns.length, 1, cv.CV_32FC2);
		let dst_mat = new cv.Mat(dst_point_ns.length, 1, cv.CV_32FC2);
		src_mat.data32F.set(src_point_ns);
		dst_mat.data32F.set(dst_point_ns);

		this._homography = cv.findHomography(src_mat, dst_mat, cv.RANSAC);
		src_mat.delete();
		dst_mat.delete();
	}

	/** 更新匹配结果 */
	private _update_matching_result(): void {
		// 暴力匹配
		if (this._init_data.match_ratio) {
			let matcher = new this._init_data.matcher();
			matcher.knnMatch(
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
			let matcher = new this._init_data.matcher(cv.NORM_HAMMING, true);
			matcher.match(
				this._img.descriptors,
				this._img_temp.descriptors,
				this._match_result_filter
			);
		}
		// 绘制匹配线
		this._draw_match_line();
	}
}

export namespace camera_position_ {
	/** 绘制数据 */
	export enum draw {
		/** 关键点 */
		key_point = 1,
		/** 匹配点 */
		match_point = 2,
	}

	/** 初始化数据 */
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
		/** 图片节点（0：定位图，1：临时图、绘制节点下必须存在 Graphics 组件） */
		node_as?: cc.Node[] = [];
		/** 绘图组件 */
		graphics?: cc.Graphics;
		/** 绘制类型 */
		draw_type_n? = 0;
	}
}

export default camera_position;
