import * as cc from "cc";

namespace _camera_positioning {
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
			// 必须先 delete 才能 reset
			if (this.img) {
				return;
			}

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
class camera_positioning {
	constructor(init_: camera_positioning_.init_config) {
		this._init_data = new camera_positioning_.init_config(init_);

		// 绘制节点
		this._img.node = this._init_data.node_as![0];
		this._img_temp.node = this._init_data.node_as![1];
	}
	/* --------------- private --------------- */
	private _init_data!: camera_positioning_.init_config;
	/** 定位图 */
	private _img = new _camera_positioning.img_data();
	/** 临时图 */
	private _img_temp = new _camera_positioning.img_data();
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
	/** 定位图匹配点数组 */
	private _img_temp_match_point_ns: number[] = [];
	/** 临时图匹配点数组 */
	private _img_match_point_ns: number[] = [];
	/* ------------------------------- 功能 ------------------------------- */
	/** 初始化 */
	init(): void {
		this._img.reset(this._init_data.img);
		this._feature_extraction(this._img);
	}

	/** 销毁 */
	destroy(): void {
		this._img.delete();
		this._init_data.matcher.delete();
		this._init_data.knn_matcher.delete();
		this._init_data.extractor.delete();
	}

	/** 清理数据 */
	clear(): void {
		this._img_temp_match_point_ns.splice(0, this._img_temp_match_point_ns.length);
		this._img_match_point_ns.splice(0, this._img_match_point_ns.length);
		while (this._delete_as.length) {
			this._delete_as.pop().delete();
		}
	}

	/** 匹配图像 */
	match(img_: _camera_positioning.img_t, output_image: cc.Sprite): void {
		// this._auto_delete(this._img);
		this._auto_delete(this._img_temp);
		this._match_result = this._auto_delete(new cv.DMatchVectorVector());
		this._match_result_filter = this._auto_delete(new cv.DMatchVector());

		console.time("reset");
		// 初始化图
		this._img.reset(this._init_data.img);
		this._img_temp.reset(img_);
		console.timeEnd("reset");

		// 特征提取
		console.time("_extract_features");
		this._feature_extraction(this._img);
		this._feature_extraction(this._img_temp);
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
			(this._image_final_result = this._auto_delete(new cv.Mat())),
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

	/** 自动清理数据 */
	private _auto_delete<T extends { delete: () => void }>(data_: T): T {
		this._delete_as.push(data_);
		return data_;
	}

	/** 绘制匹配线 */
	private _draw_match_line(): void {
		// 绘制匹配结果
		if (
			this._init_data.graphics &&
			this._init_data.draw_type_n! & camera_positioning_.draw.match_point
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
	 * 特征提取
	 */
	private _feature_extraction(img_: _camera_positioning.img_data): boolean {
		if (img_.key_points.size()) {
			return true;
		}

		// 检查关键点并计算描述符
		this._init_data.extractor.detectAndCompute(
			img_.img_gray,
			this._auto_delete(new cv.Mat()),
			img_.key_points,
			img_.descriptors
		);
		if (!img_.key_points.size() || img_.descriptors.empty()) {
			return false;
		}

		// 绘制关键点
		if (img_.node && this._init_data.draw_type_n! & camera_positioning_.draw.key_point) {
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
		let src_mat = this._auto_delete(
			new cv.Mat(this._img_temp_match_point_ns.length * 0.5, 1, cv.CV_32FC2)
		);
		let dst_mat = this._auto_delete(
			new cv.Mat(this._img_match_point_ns.length * 0.5, 1, cv.CV_32FC2)
		);
		src_mat.data32F.set(this._img_temp_match_point_ns);
		dst_mat.data32F.set(this._img_match_point_ns);

		this._homography = this._auto_delete(cv.findHomography(src_mat, dst_mat, cv.RANSAC));
	}

	/** 更新匹配结果 */
	private _update_matching_result(): void {
		// 筛选匹配点
		{
			let matcher: any;
			// 暴力匹配
			if (this._init_data.match_ratio) {
				matcher = this._init_data.knn_matcher;
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

						// 录入数组
						{
							this._img_match_point_ns.push(
								this._img.key_points.get(point.queryIdx).pt.x
							);
							this._img_match_point_ns.push(
								this._img.key_points.get(point.queryIdx).pt.y
							);
							this._img_temp_match_point_ns.push(
								this._img_temp.key_points.get(point.trainIdx).pt.x
							);
							this._img_temp_match_point_ns.push(
								this._img_temp.key_points.get(point.trainIdx).pt.y
							);
						}
					}
				}
			}
			// 匹配算法
			else {
				matcher = this._init_data.matcher;
				matcher.match(
					this._img.descriptors,
					this._img_temp.descriptors,
					this._match_result_filter
				);

				// 录入数组
				{
					for (
						let k_n = 0, len_n = this._match_result_filter.size();
						k_n < len_n;
						++k_n
					) {
						this._img_match_point_ns.push(
							this._img.key_points.get(this._match_result_filter.get(k_n).queryIdx).pt
								.x
						);
						this._img_match_point_ns.push(
							this._img.key_points.get(this._match_result_filter.get(k_n).queryIdx).pt
								.y
						);
						this._img_temp_match_point_ns.push(
							this._img_temp.key_points.get(
								this._match_result_filter.get(k_n).trainIdx
							).pt.x
						);
						this._img_temp_match_point_ns.push(
							this._img_temp.key_points.get(
								this._match_result_filter.get(k_n).trainIdx
							).pt.y
						);
					}
				}
			}
			matcher.clear();
		}

		// 绘制匹配线
		this._draw_match_line();
	}
}

export namespace camera_positioning_ {
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
		img!: _camera_positioning.img_t;
		/** 特征提取器 */
		extractor: any;
		/** 匹配器 */
		matcher: any;
		/** 暴力匹配器 */
		knn_matcher: any;
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

export default camera_positioning;
