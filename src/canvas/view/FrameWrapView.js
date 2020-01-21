import Backbone from 'backbone';
import FrameView from './FrameView';
import { bindAll, isNumber, isNull, debounce } from 'underscore';
import { createEl } from 'utils/dom';
import Dragger from 'utils/Dragger';

const motionsEv =
  'transitionend oTransitionEnd transitionend webkitTransitionEnd';

export default Backbone.View.extend({
  events: {
    'click [data-action-remove]': 'remove',
    'mousedown [data-action-move]': 'startDrag'
  },

  initialize(opts = {}, conf = {}) {
    bindAll(this, 'onScroll', 'frameLoaded', 'updateOffset');
    const { model } = this;
    const config = {
      ...(opts.config || conf),
      frameWrapView: this
    };
    const { canvasView, em } = config;
    this.cv = canvasView;
    this.config = config;
    this.em = em;
    this.canvas = em && em.get('Canvas');
    this.ppfx = config.pStylePrefix || '';
    this.frame = new FrameView({ model, config });
    this.classAnim = `${this.ppfx}frame-wrapper--anim`;
    this.listenTo(model, 'change:x change:y', this.updatePos);
    this.listenTo(model, 'loaded change:width change:height', this.updateDim);
    this.updatePos();
    this.setupDragger();
  },

  setupDragger() {
    const { canvas, model } = this;
    let dragX, dragY, zoom;
    const toggleEffects = on => {
      canvas.toggleFramesEvents(on);
    };

    this.dragger = new Dragger({
      onStart: () => {
        const { x, y } = model.attributes;
        zoom = this.em.getZoomMultiplier();
        dragX = x;
        dragY = y;
        toggleEffects();
      },
      onEnd: () => toggleEffects(1),
      setPosition: posOpts => {
        model.set({
          x: dragX + posOpts.x * zoom,
          y: dragY + posOpts.y * zoom
        });
      }
    });
  },

  startDrag(ev) {
    ev && this.dragger.start(ev);
  },

  remove() {
    Backbone.View.prototype.remove.apply(this, arguments);
    this.frame.remove();
    return this;
  },

  updateOffset: debounce(function() {
    this.em.runDefault({ preserveSelected: 1 });
    this.$el.removeClass(this.classAnim);
  }),

  updatePos(md) {
    const { model, el } = this;
    const { x, y } = model.attributes;
    const { style } = el;
    this.frame.rect = 0;
    style.left = isNaN(x) ? x : `${x}px`;
    style.top = isNaN(y) ? y : `${y}px`;
    md && this.updateOffset();
  },

  /**
   * Update dimensions of the frame
   * @private
   */
  updateDim() {
    const { em, el, $el, model, classAnim } = this;
    const { width, height } = model.attributes;
    const { style } = el;
    const currW = style.width || '';
    const currH = style.height || '';
    const newW = width;
    const newH = height;
    const noChanges = currW == newW && currH == newH;
    const un = 'px';
    this.frame.rect = 0;
    $el.addClass(classAnim);
    style.width = isNumber(newW) ? `${newW}${un}` : newW;
    style.height = isNumber(newH) ? `${newH}${un}` : newH;

    // Set width and height from DOM (should be done only once)
    if (isNull(width) || isNull(height)) {
      const newDims = {
        ...(!width ? { width: el.offsetWidth } : {}),
        ...(!height ? { height: el.offsetHeight } : {})
      };
      model.set(newDims, { silent: 1 });
    }

    // Prevent fixed highlighting box which appears when on
    // component hover during the animation
    em.stopDefault({ preserveSelected: 1 });
    noChanges ? this.updateOffset() : $el.one(motionsEv, this.updateOffset);
  },

  onScroll() {
    const { frame, em } = this;
    em.trigger('frame:scroll', {
      frame,
      body: frame.getBody(),
      target: frame.getWindow()
    });
  },

  frameLoaded() {
    const { frame } = this;
    frame.getWindow().onscroll = this.onScroll;
  },

  render() {
    const { frame, $el, ppfx, cv, model } = this;
    frame.render();
    $el
      .empty()
      .attr({ class: `${ppfx}frame-wrapper` })
      // .append(
      //   `<div class="${ppfx}frame-wrapper__header">
      //   <div class="${ppfx}frame-wrapper__name" data-action-move>
      //     ${model.get('name') || ''}
      //   </div>
      //   <span data-action-remove>
      //     <i class="fa fa-trash"></i>
      //   </span>
      // </div>`)
      .append(frame.el);
    const elTools = createEl(
      'div',
      {
        class: `${ppfx}tools`,
        style: 'pointer-events:none'
      },
      `
      <div class="${ppfx}highlighter" data-hl></div>
      <div class="${ppfx}badge" data-badge></div>
      <div class="${ppfx}placeholder">
        <div class="${ppfx}placeholder-int"></div>
      </div>
      <div class="${ppfx}ghost"></div>
      <div class="${ppfx}toolbar" style="pointer-events:all"></div>
      <div class="${ppfx}resizer"></div>
      <div class="${ppfx}offset-v" data-offset>
        <div class="gjs-marginName" data-offset-m>
          <div class="gjs-margin-v-el gjs-margin-v-top" data-offset-m-t></div>
          <div class="gjs-margin-v-el gjs-margin-v-bottom" data-offset-m-b></div>
          <div class="gjs-margin-v-el gjs-margin-v-left" data-offset-m-l></div>
          <div class="gjs-margin-v-el gjs-margin-v-right" data-offset-m-r></div>
        </div>
        <div class="gjs-paddingName" data-offset-m>
          <div class="gjs-padding-v-el gjs-padding-v-top" data-offset-p-t></div>
          <div class="gjs-padding-v-el gjs-padding-v-bottom" data-offset-p-b></div>
          <div class="gjs-padding-v-el gjs-padding-v-left" data-offset-p-l></div>
          <div class="gjs-padding-v-el gjs-padding-v-right" data-offset-p-r></div>
        </div>
      </div>
      <div class="${ppfx}offset-fixed-v"></div>
    `
    );
    this.elTools = elTools;
    cv.toolsWrapper.appendChild(elTools); // TODO remove on frame remove
    model.on('loaded', this.frameLoaded);
    return this;
  }
});