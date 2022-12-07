declare module "cc" {
	// 节点扩展
	interface Node {
		/** 节点渲染次序 */
		zIndex: number;
		/** 宽 */
		width: number;
		/** 高 */
		height: number;
		/** 透明度 */
		opacity: number;
	}

	// 节点组件扩展
	interface Node {
		label: Label;
		mask: Mask;
		render_root_2d: RenderRoot2D;
		rich_text: RichText;
		sprite: Sprite;
		animation: Animation;
		rigid_body: RigidBody;
		rigid_body_2d: RigidBody2D;
		button: Button;
		canvas: Canvas;
		edit_box: EditBox;
		label_outline: LabelOutline;
		label_shadow: LabelShadow;
		layout: Layout;
		page_view: PageView;
		progress_bar: ProgressBar;
		safe_area: SafeArea;
		scroll_bar: ScrollBar;
		scroll_view: ScrollView;
		slider: Slider;
		toggle: Toggle;
		toggle_container: ToggleContainer;
		ui_opacity: UIOpacity;
		ui_transform: UITransform;
		widget: Widget;
		graphics: Graphics;
	}
}

export {};
