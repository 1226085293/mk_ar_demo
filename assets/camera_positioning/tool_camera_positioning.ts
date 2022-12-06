import * as cc from "cc";

namespace _tool_camera_positioning {
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
class tool_camera_positioning {
	constructor(init_: tool_camera_positioning_.init_config) {
		this._init_data = new tool_camera_positioning_.init_config(init_);

		// 绘制节点
		this._img.node = this._init_data.node_as![0];
		this._img_temp.node = this._init_data.node_as![1];
	}
	/* --------------- private --------------- */
	private _init_data!: tool_camera_positioning_.init_config;
	/** 定位图 */
	private _img = new _tool_camera_positioning.img_data();
	/** 临时图 */
	private _img_temp = new _tool_camera_positioning.img_data();
	/** 上次临时图 */
	private _pre_img_temp: _tool_camera_positioning.img_data | null = null;
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
	/** 空矩阵 */
	private _none_mat: any;
	/** 光流跟踪状态 */
	private _track_status_b = false;
	/** 匹配点数量 */
	private _matches_n = 0;
	/** 定位图定位点 */
	private _img_pos_mat = new cv.Mat(4, 1, cv.CV_32FC2);
	/** 临时图定位点 */
	private _img_temp_pos_mat = new cv.Mat(4, 1, cv.CV_32FC2);
	/* ------------------------------- 功能 ------------------------------- */
	/** 初始化 */
	init(): void {
		this._none_mat = new cv.Mat();
		this._image_final_result = new cv.Mat();
		this._img.reset(this._init_data.img);
		this._feature_extraction(this._img);

		// 初始化定位图四角坐标
		this._img_pos_mat.data32F.set([
			// 左下
			0,
			0,
			// 右下
			this._img.img.cols,
			0,
			// 右上
			this._img.img.cols,
			this._img.img.rows,
			// 左上
			0,
			this._img.img.rows,
		]);
	}

	/** 销毁 */
	destroy(): void {
		this._img_pos_mat.delete();
		this._img_temp_pos_mat.delete();
		this._image_final_result.delete();
		this._img.delete();
		this._init_data.matcher.delete();
		this._init_data.knn_matcher.delete();
		this._init_data.extractor.delete();
	}

	/** 清理数据 */
	clear(): void {
		while (this._delete_as.length) {
			this._delete_as.pop().delete();
		}
	}

	/** 计算 */
	calculate(img_: _tool_camera_positioning.img_t): void {
		// 光流
		if (this._track_status_b) {
			if (!this._pre_img_temp) {
				return;
			}
			// 初始化图
			console.time("初始化图");

			this._img_temp.reset(img_);
			console.timeEnd("初始化图");

			/** 上次匹配点 */
			let framePts = new cv.Mat(this._img_match_point_ns.length * 0.5, 1, cv.CV_32FC2);
			framePts.data32F.set(this._img_match_point_ns);
			/** 当前匹配点 */
			let currPts = new cv.Mat();
			/** 状态 */
			let status = new cv.Mat();
			/** 错误 */
			let err = new cv.Mat();
			console.time("calcOpticalFlowPyrLK");
			cv.calcOpticalFlowPyrLK(
				this._pre_img_temp.img_gray,
				this._img_temp.img_gray,
				framePts,
				currPts,
				status,
				err
			);
			console.timeEnd("calcOpticalFlowPyrLK");

			// https://docs.opencv.org/3.4/d9/dab/tutorial_homography.html

			let goodPtsCurrNS: number[] = [];
			let goodPtsPrevNS: number[] = [];
			// 计算平均方差
			let mean,
				avg_variance = 0.0;
			let sum = 0.0;
			let diff: number;
			let diffs: number[] = [];
			for (let i = 0; i < framePts.data64F.length; ++i) {
				if (status.data[i]) {
					goodPtsCurrNS.push(currPts.data64F[i]);
					goodPtsPrevNS.push(framePts.data64F[i]);
					diff = Math.sqrt(
						Math.pow(currPts.data32F[i * 2] - framePts.data32F[i * 2], 2.0) +
							Math.pow(currPts.data32F[i * 2 + 1] - framePts.data32F[i * 2 + 1], 2.0)
					);
					sum += diff;
					diffs.push(diff);
				}
			}

			mean = sum / diffs.length;
			for (let i = 0; i < goodPtsCurrNS.length; ++i) {
				avg_variance += Math.pow(diffs[i] - mean, 2);
			}
			avg_variance /= diffs.length;

			console.log("平均方差", avg_variance);
			if (goodPtsCurrNS.length > this._matches_n / 2 && 1.75 > avg_variance) {
				let goodPtsCurr = this._auto_delete(
					new cv.Mat(goodPtsCurrNS.length, 1, cv.CV_32FC2)
				);
				let goodPtsPrev = this._auto_delete(
					new cv.Mat(goodPtsPrevNS.length, 1, cv.CV_32FC2)
				);
				goodPtsCurr.data64F.set(goodPtsCurrNS);
				goodPtsPrev.data64F.set(goodPtsPrevNS);

				let transform = cv.estimateAffine2D(goodPtsPrev, goodPtsCurr);

				// 添加行 {0,0,1} 进行转换，使其成为 3x3
				let temp = new cv.Mat(3, 3, cv.CV_64F);
				temp.data64F.set([...transform.data64F.slice(0), 0, 0, 1]);
				transform.delete();
				transform = temp;

				// update homography matrix
				let homographyCCMat3 = new cc.Mat3(...this._homography.data64F);
				let transformCCMat3 = new cc.Mat3(...transform.data64F);

				let transform22 = cc.mat4(
					// 0
					this._homography.doubleAt(0, 0),
					this._homography.doubleAt(1, 0),
					0,
					this._homography.doubleAt(2, 0),
					// 1
					this._homography.doubleAt(0, 1),
					this._homography.doubleAt(1, 1),
					0,
					this._homography.doubleAt(2, 1),
					// 2
					0,
					0,
					1,
					0,
					// 3
					this._homography.doubleAt(0, 2),
					this._homography.doubleAt(1, 2),
					0,
					this._homography.doubleAt(2, 2)
				);

				console.log(
					"旋转",
					transform22.getRotation(cc.quat()).getEulerAngles(cc.v3()).toString()
				);
				console.log("平移", transform22.getTranslation(cc.v3()).toString());
				console.log("缩放", transform22.getScale(cc.v3()).toString());

				homographyCCMat3 = homographyCCMat3.multiply(transformCCMat3);
				this._homography.data64F.set(cc.Mat3.toArray([], homographyCCMat3));

				transform22 = cc.mat4(
					// 0
					this._homography.doubleAt(0, 0),
					this._homography.doubleAt(1, 0),
					0,
					this._homography.doubleAt(2, 0),
					// 1
					this._homography.doubleAt(0, 1),
					this._homography.doubleAt(1, 1),
					0,
					this._homography.doubleAt(2, 1),
					// 2
					0,
					0,
					1,
					0,
					// 3
					this._homography.doubleAt(0, 2),
					this._homography.doubleAt(1, 2),
					0,
					this._homography.doubleAt(2, 2)
				);

				console.log(
					"旋转",
					transform22.getRotation(cc.quat()).getEulerAngles(cc.v3()).toString()
				);
				console.log("平移", transform22.getTranslation(cc.v3()).toString());
				console.log("缩放", transform22.getScale(cc.v3()).toString());

				// set old points to new points
				this._img_match_point_ns = goodPtsCurrNS; // framePts = goodPtsCurr;

				this._track_status_b = this._homography_valid(this._homography);
				if (this._track_status_b) {
					this.fill_output();
				}
			}
			debugger;
		}
		// 重新跟踪
		else {
			this._match(img_);
		}
	}

	/** 匹配图像 */
	_match(img_: _tool_camera_positioning.img_t): void {
		this._auto_delete(this._pre_img_temp!);
		this._match_result = this._auto_delete(new cv.DMatchVectorVector());
		this._match_result_filter = this._auto_delete(new cv.DMatchVector());

		// 初始化图
		console.time("初始化图");
		this._img_temp.reset(img_);
		console.timeEnd("初始化图");

		// 特征提取
		console.time("特征提取");
		this._feature_extraction(this._img_temp);
		console.timeEnd("特征提取");

		// 获取匹配结果
		console.time("获取匹配结果");
		this._update_matching_result();
		console.timeEnd("获取匹配结果");

		// 计算单应性矩阵
		console.time("计算单应性矩阵");
		this._calculate_homography();
		console.timeEnd("计算单应性矩阵");

		this._track_status_b = this._homography_valid(this._homography);
		if (this._track_status_b) {
			this._matches_n = this._match_result_filter.size();
			this.fill_output();
			this._pre_img_temp = this._img_temp;
			this._img_temp = new _tool_camera_positioning.img_data();
		} else {
			this._auto_delete(this._img_temp);
		}

		this.clear();
		// // https://ahmetozlu.medium.com/marker-less-augmented-reality-by-opencv-and-opengl-531b2af0a130
		// // https://raw.githubusercontent.com/ahmetozlu/open_source_markerless_augmented_reality/master/MarkerlessAR_V2/src/PatternDetector.cpp
	}

	fill_output(): void {
		cv.perspectiveTransform(this._img_pos_mat, this._img_temp_pos_mat, this._homography);
		// Normalization to ensure that ||c1|| = 1
		let norm = Math.sqrt(
			this._homography.doubleAt(0, 0) * this._homography.doubleAt(0, 0) +
				this._homography.doubleAt(1, 0) * this._homography.doubleAt(1, 0) +
				this._homography.doubleAt(2, 0) * this._homography.doubleAt(2, 0)
		);

		let homographyCCMat = new cc.Mat3(...this._homography.data64F);
		homographyCCMat.multiplyScalar(1 / norm);
		let c1 = cc.v3(homographyCCMat.m00, homographyCCMat.m01, homographyCCMat.m02);
		let c2 = cc.v3(homographyCCMat.m03, homographyCCMat.m04, homographyCCMat.m05);
		let c3 = c1.cross(c2);
		// let c1 = this._homography.col(0);
		// let c2 = this._homography.col(1);
		// let c3 = c1.cross(c2);
		let tvec = this._homography.col(2);
		let R = new cv.Mat(3, 3, cv.CV_64F);
		R.data64F.set([c1.x, c2.x, c3.x, c1.y, c2.y, c3.y, c1.z, c2.z, c3.z]);
		// for (let i = 0; i < 3; i++) {
		// R.doubleAt(i, 0) = c1.doubleAt(i, 0);
		// R.doubleAt(i, 1) = c2.doubleAt(i, 0);
		// R.doubleAt(i, 2) = c3.doubleAt(i, 0);
		// }

		// let transform = cc.mat4(
		// 	// 0
		// 	this._homography.doubleAt(0, 0),
		// 	this._homography.doubleAt(1, 0),
		// 	0,
		// 	this._homography.doubleAt(2, 0),
		// 	// 1
		// 	this._homography.doubleAt(0, 1),
		// 	this._homography.doubleAt(1, 1),
		// 	0,
		// 	this._homography.doubleAt(2, 1),
		// 	// 2
		// 	0,
		// 	0,
		// 	1,
		// 	0,
		// 	// 3
		// 	this._homography.doubleAt(0, 2),
		// 	this._homography.doubleAt(1, 2),
		// 	0,
		// 	this._homography.doubleAt(2, 2)
		// );

		// console.log("旋转", transform.getRotation(cc.quat()).getEulerAngles(cc.v3()).toString());
		// console.log("平移", transform.getTranslation(cc.v3()).toString());
		// console.log("缩放", transform.getScale(cc.v3()).toString());
		// // 转换后点
		// cc.log(this._img_temp_pos_mat.data32F);

		// output->valid = valid;
	}

	/** 单应性有效判断 */
	private _homography_valid(H: any): boolean {
		const N = 10;
		const det = H.doubleAt(0, 0) * H.doubleAt(1, 1) - H.doubleAt(1, 0) * H.doubleAt(0, 1);
		return 1 / N < Math.abs(det) && Math.abs(det) < N;
	}

	/** 自动清理数据 */
	private _auto_delete<T extends { delete: () => void }>(data_: T): T {
		if (!data_) {
			return data_;
		}
		this._delete_as.push(data_);
		return data_;
	}

	/** 绘制匹配线 */
	private _draw_match_line(): void {
		// 绘制匹配结果
		if (
			this._init_data.graphics &&
			this._init_data.draw_type_n! & tool_camera_positioning_.draw.match_point
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
	private _feature_extraction(img_: _tool_camera_positioning.img_data): boolean {
		if (img_.key_points.size()) {
			return true;
		}

		// 检查关键点并计算描述符
		this._init_data.extractor.detectAndCompute(
			img_.img_gray,
			this._none_mat,
			img_.key_points,
			img_.descriptors
		);
		if (!img_.key_points.size() || img_.descriptors.empty()) {
			return false;
		}

		// 绘制关键点
		if (img_.node && this._init_data.draw_type_n! & tool_camera_positioning_.draw.key_point) {
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
	private _calculate_homography(): void {
		let src_mat = this._auto_delete(
			new cv.Mat(this._img_temp_match_point_ns.length * 0.5, 1, cv.CV_32FC2)
		);
		let dst_mat = this._auto_delete(
			new cv.Mat(this._img_match_point_ns.length * 0.5, 1, cv.CV_32FC2)
		);
		src_mat.data32F.set(this._img_temp_match_point_ns);
		dst_mat.data32F.set(this._img_match_point_ns);

		this._homography = cv.findHomography(src_mat, dst_mat, cv.RANSAC);
	}

	/** 更新匹配结果 */
	private _update_matching_result(): void {
		this._img_temp_match_point_ns.splice(0, this._img_temp_match_point_ns.length);
		this._img_match_point_ns.splice(0, this._img_match_point_ns.length);
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

export namespace tool_camera_positioning_ {
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
		img!: _tool_camera_positioning.img_t;
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

export default tool_camera_positioning;
