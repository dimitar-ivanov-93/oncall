import React, { useEffect, useState } from 'react';

import { Icon, IconButton, IconName } from '@grafana/ui';
import cn from 'classnames/bind';
import { isArray, isUndefined } from 'lodash-es';

import styles from './IntegrationCollapsibleTreeView.module.scss';

const cx = cn.bind(styles);

export interface IntegrationCollapsibleItem {
  customIcon?: IconName;
  expandedView: React.ReactNode;
  collapsedView: React.ReactNode;
  isCollapsible: boolean;
  isExpanded?: boolean;
  canHoverIcon?: boolean;
  onStateChange?(): void;
}

interface IntegrationCollapsibleTreeViewProps {
  configElements: Array<IntegrationCollapsibleItem | IntegrationCollapsibleItem[]>;
}

const IntegrationCollapsibleTreeView: React.FC<IntegrationCollapsibleTreeViewProps> = (props) => {
  const { configElements } = props;

  const [expandedList, setExpandedList] = useState(getStartingExpandedState());

  useEffect(() => {
    setExpandedList(getStartingExpandedState());
  }, [configElements]);

  return (
    <div className={cx('integrationTree__container')}>
      {configElements.map((item: IntegrationCollapsibleItem | IntegrationCollapsibleItem[], idx) => {
        if (isArray(item)) {
          return item.map((it, innerIdx) => (
            <IntegrationCollapsibleTreeItem
              item={it}
              key={`${idx}-${innerIdx}`}
              onClick={() => expandOrCollapseAtPos(idx, innerIdx)}
              isExpanded={expandedList[idx][innerIdx]}
            />
          ));
        }

        return (
          <IntegrationCollapsibleTreeItem
            item={item}
            key={idx}
            onClick={() => expandOrCollapseAtPos(idx)}
            isExpanded={expandedList[idx] as boolean}
          />
        );
      })}
    </div>
  );

  function getStartingExpandedState(): Array<boolean | boolean[]> {
    const expandedArrayValues = new Array<boolean | boolean[]>(configElements.length);
    configElements.forEach((elem, index) => {
      if (Array.isArray(elem)) {
        expandedArrayValues[index] = elem.map((el) => !el.isCollapsible || el.isExpanded);
      } else {
        expandedArrayValues[index] = !elem.isCollapsible || elem.isExpanded;
      }
    });

    return expandedArrayValues;
  }

  function expandOrCollapseAtPos(i: number, j: number = undefined) {
    if (j) {
      let elem = configElements[i] as IntegrationCollapsibleItem[];
      if (elem[j].onStateChange) {
        elem[j].onStateChange();
      }
    } else {
      let elem = configElements[i] as IntegrationCollapsibleItem;
      if (elem.onStateChange) {
        elem.onStateChange();
      }
    }

    setExpandedList(
      expandedList.map((elem, index) => {
        if (!isUndefined(j) && index === i) {
          return (elem as boolean[]).map((innerElem: boolean, jIndex: number) =>
            jIndex === j ? !innerElem : innerElem
          );
        }

        return index === i ? !elem : elem;
      })
    );
  }
};

const IntegrationCollapsibleTreeItem: React.FC<{
  item: IntegrationCollapsibleItem;
  isExpanded: boolean;
  onClick: () => void;
  canHoverIcon?: boolean;
}> = ({ item, isExpanded, onClick, canHoverIcon = true }) => {
  const iconOnClickFn = !item.isCollapsible ? undefined : onClick;

  return (
    <div className={cx('integrationTree__group')}>
      <div className={cx('integrationTree__icon')}>
        {canHoverIcon ? (
          <IconButton name={getIconName()} onClick={iconOnClickFn} size="lg" />
        ) : (
          <Icon name={getIconName()} onClick={iconOnClickFn} size="lg" />
        )}
      </div>
      <div className={cx('integrationTree__element', { 'integrationTree__element--visible': isExpanded })}>
        {item.expandedView}
      </div>
      <div className={cx('integrationTree__element', { 'integrationTree__element--visible': !isExpanded })}>
        {item.collapsedView}
      </div>
    </div>
  );

  function getIconName(): IconName {
    if (item.customIcon) {
      return item.customIcon;
    }
    return isExpanded ? 'angle-down' : 'angle-right';
  }
};

export default IntegrationCollapsibleTreeView;
