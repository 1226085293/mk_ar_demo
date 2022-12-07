const component_ss = {
	label: "cc.Label",
	mask: "cc.Mask",
	render_root_2d: "cc.RenderRoot2D",
	rich_text: "cc.RichText",
	sprite: "cc.Sprite",
	animation: "cc.Animation",
	rigid_body: "cc.RigidBody",
	rigid_body_2d: "cc.RigidBody2D",
	button: "cc.Button",
	canvas: "cc.Canvas",
	edit_box: "cc.EditBox",
	label_outline: "cc.LabelOutline",
	label_shadow: "cc.LabelShadow",
	layout: "cc.Layout",
	page_view: "cc.PageView",
	progress_bar: "cc.ProgressBar",
	safe_area: "cc.SafeArea",
	scroll_bar: "cc.ScrollBar",
	scroll_view: "cc.ScrollView",
	slider: "cc.Slider",
	toggle: "cc.Toggle",
	toggle_container: "cc.ToggleContainer",
	ui_opacity: "cc.UIOpacity",
	ui_transform: "cc.UITransform",
	widget: "cc.Widget",
	graphics: "cc.Graphics",
};

// 节点组件扩展
for (const k_s in component_ss) {
	const component_tab = cc.js.createMap();

	Object.defineProperty(cc.Node.prototype, k_s, {
		get: function () {
			if (component_tab[this.uuid]?.isValid) {
				return component_tab[this.uuid];
			}
			return (component_tab[this.uuid] =
				this.getComponent(component_ss[k_s]) ?? this.addComponent(component_ss[k_s]));
		},
		configurable: true,
	});
}

// zIndex
Object.defineProperty(cc.Node.prototype, "zIndex", {
	get: function () {
		return (this.getComponent(cc.UITransform) ?? this.addComponent(cc.UITransform)).priority;
	},
	set: function (value_n_) {
		(this.getComponent(cc.UITransform) ?? this.addComponent(cc.UITransform)).priority =
			value_n_;
	},
	configurable: true,
});

// width
{
	const desc = Object.getOwnPropertyDescriptor(cc.Node.prototype, "width");

	desc.get = function () {
		return (this.getComponent(cc.UITransform) ?? this.addComponent(cc.UITransform)).contentSize
			.width;
	};
	desc.set = function (value_n_) {
		const comp = this.getComponent(cc.UITransform) ?? this.addComponent(cc.UITransform);

		comp.setContentSize(cc.size(value_n_, comp.height));
	};
}

// height
{
	const desc = Object.getOwnPropertyDescriptor(cc.Node.prototype, "height");

	desc.get = function () {
		return (this.getComponent(cc.UITransform) ?? this.addComponent(cc.UITransform)).contentSize
			.height;
	};
	desc.set = function (value_n_) {
		const comp = this.getComponent(cc.UITransform) ?? this.addComponent(cc.UITransform);

		comp.setContentSize(cc.size(comp.width, value_n_));
	};
}

// opacity
Object.defineProperty(cc.Node.prototype, "opacity", {
	get: function () {
		return (this.getComponent(cc.UIOpacity) ?? this.addComponent(cc.UIOpacity)).opacity;
	},
	set: function (value_n_) {
		(this.getComponent(cc.UIOpacity) ?? this.addComponent(cc.UIOpacity)).opacity = value_n_;
	},
	configurable: true,
});
