import bind from 'decorators/bind';
import getElementPosition from 'helpers/get-element-position';
import velocity from 'velocity-animate';
import Component from 'components/component';
import Draggable from 'components/dnd/draggable';
import Droppable from 'components/dnd/droppable';
import React, {PropTypes} from 'react';
import {findDOMNode} from 'react-dom';

import styles from './element.less';
import Empty from './empty';
import Highlight from './highlight';

export default class Element extends Component {
  static propTypes = {
    display: PropTypes.string.isRequired,
    editing: PropTypes.bool.isRequired,
    settings: PropTypes.object.isRequired,
    element: PropTypes.object.isRequired,
    positionInParent: PropTypes.number.isRequired,
    selected: PropTypes.bool.isRequired,
    overed: PropTypes.bool.isRequired,
    selectElement: PropTypes.func.isRequired,
    htmlTag: PropTypes.string.isRequired,
    className: PropTypes.string,
    style: PropTypes.object,
    animation: PropTypes.bool,
    animated: PropTypes.bool.isRequired,
    animatedEditing: PropTypes.bool.isRequired,
    children: PropTypes.node,
    dragging: PropTypes.bool.isRequired,
    overElement: PropTypes.func.isRequired,
    outElement: PropTypes.func.isRequired,
    onEnterScreen: PropTypes.func,
    startAnimation: PropTypes.func.isRequired,
    resetAnimation: PropTypes.func.isRequired,
    contentElementId: PropTypes.string,
    focused: PropTypes.bool,
    disableSelection: PropTypes.bool,
    context: PropTypes.string
  };

  static defaultProps = {
    style: {},
    className: ''
  };

  componentDidMount () {
    const {editing, animation, onEnterScreen} = this.props;

    if ((!editing && animation) || onEnterScreen) {
      this.onScrollBind = ::this.onScroll;
      window.addEventListener('scroll', this.onScrollBind);
      this.onScroll();
    }
    if (editing) {
      this.animationEditingBind = ::this.animationEditing;
      window.addEventListener('animateElements', this.animationEditingBind);
    }
  }

  componentWillUnmount () {
    if (this.onScrollBind) {
      window.removeEventListener('scroll', this.onScrollBind);
    }
    if (this.animationEditingBind) {
      window.removeEventListener('animateElements', this.animationEditingBind);
    }
    if (this.animationTimeout) {
      clearTimeout(this.animationTimeout);
    }
  }

  @bind
  animate () {
    const dom = findDOMNode(this);
    const {animation, startAnimation} = this.props;
    startAnimation();
    velocity(dom, animation.effect, {
      duration: animation.duration,
      display: null
    });
  }

  animationInit () {
    const animation = this.props.animation;
    if (animation) {
      this.animationTimeout = setTimeout(this.animate, animation.delay);
    }
  }

  animationEditing () {
    if (this.props.animation) {
      this.props.resetAnimation();
      this.animationInit();
    }
  }

  onScroll () {
    const dom = findDOMNode(this);
    const rect = dom.getBoundingClientRect();

    if ((rect.top <= 0 && rect.bottom >= 0) || (rect.top > 0 && rect.top < window.outerHeight)) {
      if (this.state.animation) {
        this.animationInit();
      }
      if (this.props.onEnterScreen) {
        this.props.onEnterScreen();
      }
      window.removeEventListener('scroll', this.onScrollBind);
    }
  }

  @bind
  onElementClick (event) {
    const {selectElement, element, context} = this.props;
    event.stopPropagation();
    selectElement(element.id, context);
  }

  processAnimationStyle (style) {
    const {editing, animation, animated, animatedEditing} = this.props;
    if ((editing && animatedEditing) || (!editing && animation && !animated)) {
      style.opacity = 0;
    }
  }

  processPosition (style) {
    const {element, display} = this.props;
    Object.assign(style, getElementPosition(element, display));
  }

  @bind
  onMouseOver (event) {
    const {dragging, overed, selected, overElement, element, context} = this.props;
    if (!dragging) {
      event.stopPropagation();
      clearTimeout(this.outTimeout);
      if (!overed && !selected) {
        overElement(element.id, context);
      }
    }
  }

  @bind
  onMouseOut () {
    const {dragging, overed} = this.props;
    if (!dragging && overed) {
      this.outTimeout = setTimeout(this.selectOut, 50);
    }
  }

  @bind
  selectOut () {
    const {outElement, element, context} = this.props;
    outElement(element.id, context);
  }

  render () {
    const {editing, settings, element, positionInParent, selected, disableSelection, context} = this.props;
    let result;

    if (editing && settings.drag) {
      const draggableProps = Object.assign({
        dragInfo: {
          type: 'move',
          id: element.id,
          context,
          parentId: element.parent,
          positionInParent
        },
        onClick: this.onElementClick,
        type: element.tag,
        disabled: disableSelection || (selected && settings.drag.dragSelected === false)
      }, settings.drag);

      result = (
        <Draggable {...draggableProps}>
          {this.renderTag()}
        </Draggable>
      );
    } else {
      result = this.renderTag();
    }

    return result;
  }

  renderTag () {
    const HtmlTag = this.props.htmlTag;
    const {style, className, editing, element, disableSelection} = this.props;

    const calcStyle = Object.assign({}, style);
    this.processAnimationStyle(calcStyle);
    this.processPosition(calcStyle);

    const tagProps = {
      style: calcStyle,
      className
    };

    if (editing && !disableSelection) {
      tagProps.onMouseOver = this.onMouseOver;
      tagProps.onMouseOut = this.onMouseOut;
    }
    if (editing) {
      tagProps.ref = (ref) => {
        this.ref = ref;
      };
      tagProps.id = element.id;
    }

    return (
      <HtmlTag {...tagProps}>
        {this.renderContent()}
        {this.renderHighlight()}
      </HtmlTag>
    );
  }

  renderContent () {
    const {editing, settings, element, focused, disableSelection, context} = this.props;
    let result;

    if (editing && !disableSelection && settings.drop && !settings.drop.customDropArea) {
      const droppableProps = Object.assign({
        dropInfo: {
          id: element.id,
          context
        },
        type: element.tag,
        placeholder: true,
        placeholderRender: this.renderPlaceholder
      }, settings.drop);

      result = (
        <Droppable {...droppableProps}>
          {this.props.children}
        </Droppable>
      );
    } else {
      result = this.props.children;
    }

    if (editing && focused) {
      result = (
        <div className={styles.focused}>{result}</div>
      );
    }

    return result;
  }

  @bind
  renderPlaceholder (options) {
    const {settings, element} = this.props;
    return (
      <Empty {...options} settings={settings} element={element} />
    );
  }

  renderHighlight () {
    const {editing, selected, overed, dragging, element, settings, contentElementId, focused} = this.props;
    if (editing && (focused || selected || overed) && !dragging && this.ref) {
      return (
        <Highlight
          element={element}
          settings={settings}
          selected={selected}
          focused={focused}
          contentElementId={contentElementId}
          dom={this.ref}
        />
      );
    }
  }
}
