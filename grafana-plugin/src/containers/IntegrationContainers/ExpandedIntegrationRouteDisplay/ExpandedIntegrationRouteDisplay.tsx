import React, { useEffect, useReducer } from 'react';

import { SelectableValue } from '@grafana/data';
import { Button, HorizontalGroup, InlineLabel, VerticalGroup, Icon, Tooltip, ConfirmModal, Select } from '@grafana/ui';
import cn from 'classnames/bind';
import { observer } from 'mobx-react';

import IntegrationBlock from 'components/Integrations/IntegrationBlock';
import IntegrationBlockItem from 'components/Integrations/IntegrationBlockItem';
import MonacoEditor from 'components/MonacoEditor/MonacoEditor';
import PluginLink from 'components/PluginLink/PluginLink';
import Text from 'components/Text/Text';
import TooltipBadge from 'components/TooltipBadge/TooltipBadge';
import { ChatOpsConnectors } from 'containers/AlertRules/parts';
import EscalationChainSteps from 'containers/EscalationChainSteps/EscalationChainSteps';
import styles from 'containers/IntegrationContainers/ExpandedIntegrationRouteDisplay/ExpandedIntegrationRouteDisplay.module.scss';
import TeamName from 'containers/TeamName/TeamName';
import { WithPermissionControlTooltip } from 'containers/WithPermissionControl/WithPermissionControlTooltip';
import { AlertReceiveChannel } from 'models/alert_receive_channel/alert_receive_channel.types';
import { AlertTemplatesDTO } from 'models/alert_templates';
import { ChannelFilter } from 'models/channel_filter/channel_filter.types';
import { EscalationChain } from 'models/escalation_chain/escalation_chain.types';
import { MONACO_INPUT_HEIGHT_SMALL, MONACO_OPTIONS } from 'pages/integration_2/Integration2.config';
import IntegrationHelper from 'pages/integration_2/Integration2.helper';
import { AppFeature } from 'state/features';
import { useStore } from 'state/useStore';
import { UserActions } from 'utils/authorization';

const cx = cn.bind(styles);

interface ExpandedIntegrationRouteDisplayProps {
  alertReceiveChannelId: AlertReceiveChannel['id'];
  channelFilterId: ChannelFilter['id'];
  routeIndex: number;
  templates: AlertTemplatesDTO[];
  openEditTemplateModal: (templateName: string | string[], channelFilterId?: ChannelFilter['id']) => void;
  onEditRegexpTemplate: (channelFilterId: ChannelFilter['id']) => void;
}

interface ExpandedIntegrationRouteDisplayState {
  isEscalationCollapsed: boolean;
  isRefreshingEscalationChains: boolean;
  routeIdForDeletion: string;
}

const ExpandedIntegrationRouteDisplay: React.FC<ExpandedIntegrationRouteDisplayProps> = observer(
  ({ alertReceiveChannelId, channelFilterId, templates, routeIndex, openEditTemplateModal, onEditRegexpTemplate }) => {
    const store = useStore();
    const {
      telegramChannelStore,
      teamStore,
      escalationPolicyStore,
      escalationChainStore,
      alertReceiveChannelStore,
      grafanaTeamStore,
    } = store;

    const isSlackInstalled = Boolean(teamStore.currentTeam?.slack_team_identity);
    const isTelegramInstalled =
      store.hasFeature(AppFeature.Telegram) && telegramChannelStore.currentTeamToTelegramChannel?.length > 0;

    const [{ isEscalationCollapsed, isRefreshingEscalationChains, routeIdForDeletion }, setState] = useReducer(
      (state: ExpandedIntegrationRouteDisplayState, newState: Partial<ExpandedIntegrationRouteDisplayState>) => ({
        ...state,
        ...newState,
      }),
      {
        isEscalationCollapsed: true,
        isRefreshingEscalationChains: false,
        routeIdForDeletion: undefined,
      }
    );

    useEffect(() => {
      escalationChainStore.updateItems();
    }, []);

    const channelFilter = alertReceiveChannelStore.channelFilters[channelFilterId];
    const channelFiltersTotal = Object.keys(alertReceiveChannelStore.channelFilters);
    if (!channelFilter) {
      return null;
    }

    const escalationChainRedirectObj: any = { page: 'escalations' };
    if (channelFilter.escalation_chain) {
      escalationChainRedirectObj.id = channelFilter.escalation_chain;
    }

    const channelFilterIds = alertReceiveChannelStore.channelFilterIds[alertReceiveChannelId];
    const isDefault = IntegrationHelper.getRouteConditionWording(channelFilterIds, routeIndex) === 'Default';

    return (
      <>
        <IntegrationBlock
          hasCollapsedBorder
          key={channelFilterId}
          heading={
            <HorizontalGroup justify={'space-between'}>
              <HorizontalGroup spacing={'md'}>
                <TooltipBadge
                  borderType="success"
                  text={IntegrationHelper.getRouteConditionWording(channelFilterIds, routeIndex)}
                  tooltipTitle={undefined}
                  tooltipContent={undefined}
                />
              </HorizontalGroup>
              <HorizontalGroup spacing={'xs'}>
                <RouteButtonsDisplay
                  alertReceiveChannelId={alertReceiveChannelId}
                  channelFilterId={channelFilterId}
                  routeIndex={routeIndex}
                  setRouteIdForDeletion={() => setState({ routeIdForDeletion: channelFilterId })}
                />
              </HorizontalGroup>
            </HorizontalGroup>
          }
          content={
            <VerticalGroup spacing="xs">
              {/* Show Routing Template only for If/Else Routes, not for Default */}
              {!isDefault && (
                <IntegrationBlockItem>
                  <HorizontalGroup spacing="xs">
                    <InlineLabel width={20}>Routing Template</InlineLabel>
                    <div className={cx('input', 'input--short')}>
                      <MonacoEditor
                        value={IntegrationHelper.getFilteredTemplate(channelFilter.filtering_term, false)}
                        disabled={true}
                        height={MONACO_INPUT_HEIGHT_SMALL}
                        data={templates}
                        showLineNumbers={false}
                        monacoOptions={MONACO_OPTIONS}
                      />
                    </div>
                    <Button
                      variant={'secondary'}
                      icon="edit"
                      size={'md'}
                      onClick={() => handleEditRoutingTemplate(channelFilter, channelFilterId)}
                    />
                  </HorizontalGroup>
                </IntegrationBlockItem>
              )}

              {routeIndex !== channelFiltersTotal.length - 1 && (
                <IntegrationBlockItem>
                  <VerticalGroup>
                    <Text type="secondary">
                      If the Routing template evaluates to True, the alert will be grouped with the Grouping template
                      and proceed to the following steps
                    </Text>
                  </VerticalGroup>
                </IntegrationBlockItem>
              )}

              {(isSlackInstalled || isTelegramInstalled) && (
                <IntegrationBlockItem>
                  <VerticalGroup spacing="md">
                    <Text type="primary">Publish to ChatOps</Text>
                    <ChatOpsConnectors channelFilterId={channelFilterId} showLineNumber={false} />
                  </VerticalGroup>
                </IntegrationBlockItem>
              )}

              <IntegrationBlockItem>
                <VerticalGroup>
                  <HorizontalGroup spacing={'xs'}>
                    <InlineLabel width={20}>Escalation chain</InlineLabel>
                    <WithPermissionControlTooltip userAction={UserActions.IntegrationsWrite}>
                      <Select
                        isSearchable
                        width={'auto'}
                        menuShouldPortal
                        className={cx('select', 'control')}
                        placeholder="Select escalation chain"
                        isLoading={isRefreshingEscalationChains}
                        onChange={onEscalationChainChange}
                        options={Object.keys(escalationChainStore.items).map(
                          (eschalationChainId: EscalationChain['id']) => ({
                            value: escalationChainStore.items[eschalationChainId].id,
                            label: escalationChainStore.items[eschalationChainId].name,
                          })
                        )}
                        value={channelFilter.escalation_chain}
                        getOptionLabel={(item: SelectableValue) => {
                          return (
                            <>
                              <Text>{item.label} </Text>
                              <TeamName
                                team={grafanaTeamStore.items[escalationChainStore.items[item.value].team]}
                                size="small"
                              />
                            </>
                          );
                        }}
                      ></Select>
                    </WithPermissionControlTooltip>

                    <Tooltip content={'Reload escalation chains list'} placement={'top'}>
                      <Button variant={'secondary'} icon={'sync'} size={'md'} onClick={onEscalationChainsRefresh} />
                    </Tooltip>

                    <PluginLink className={cx('hover-button')} target="_blank" query={escalationChainRedirectObj}>
                      <Tooltip
                        placement={'top'}
                        content={channelFilter.escalation_chain ? 'Edit escalation chain' : 'Add an escalation chain'}
                      >
                        <Button variant={'secondary'} icon={'external-link-alt'} size={'md'} />
                      </Tooltip>
                    </PluginLink>

                    {channelFilter.escalation_chain && (
                      <Button
                        variant={'secondary'}
                        onClick={() => setState({ isEscalationCollapsed: !isEscalationCollapsed })}
                      >
                        <HorizontalGroup>
                          <Text type="link">{isEscalationCollapsed ? 'Show' : 'Hide'} escalation chain</Text>
                          {isEscalationCollapsed && <Icon name={'angle-right'} />}
                          {!isEscalationCollapsed && <Icon name={'angle-up'} />}
                        </HorizontalGroup>
                      </Button>
                    )}
                  </HorizontalGroup>

                  {isEscalationCollapsed && (
                    <ReadOnlyEscalationChain escalationChainId={channelFilter.escalation_chain} />
                  )}
                </VerticalGroup>
              </IntegrationBlockItem>
            </VerticalGroup>
          }
        />
        {routeIdForDeletion && (
          <ConfirmModal
            isOpen
            title="Delete route?"
            body="Are you sure you want to delete this route?"
            confirmText="Delete"
            icon="exclamation-triangle"
            onConfirm={onRouteDeleteConfirm}
            onDismiss={() => setState({ routeIdForDeletion: undefined })}
          />
        )}
      </>
    );

    async function onRouteDeleteConfirm() {
      setState({ routeIdForDeletion: undefined });
      await alertReceiveChannelStore.deleteChannelFilter(routeIdForDeletion);
    }

    function onEscalationChainChange({ value }) {
      alertReceiveChannelStore
        .saveChannelFilter(channelFilterId, {
          escalation_chain: value,
        })
        .then(() => {
          escalationChainStore.updateItems(); // to update number_of_integrations and number_of_routes
          escalationPolicyStore.updateEscalationPolicies(value);
        });
    }

    async function onEscalationChainsRefresh() {
      setState({ isRefreshingEscalationChains: true });
      await escalationChainStore.updateItems();
      setState({ isRefreshingEscalationChains: false });
    }

    function handleEditRoutingTemplate(channelFilter, channelFilterId) {
      if (channelFilter.filtering_term_type === 0) {
        onEditRegexpTemplate(channelFilterId);
      } else {
        openEditTemplateModal('route_template', channelFilterId);
      }
    }
  }
);

const ReadOnlyEscalationChain: React.FC<{ escalationChainId: string }> = ({ escalationChainId }) => {
  return <EscalationChainSteps isDisabled id={escalationChainId} />;
};

interface RouteButtonsDisplayProps {
  alertReceiveChannelId: AlertReceiveChannel['id'];
  channelFilterId: ChannelFilter['id'];
  routeIndex: number;
  setRouteIdForDeletion(): void;
}

export const RouteButtonsDisplay: React.FC<RouteButtonsDisplayProps> = ({
  alertReceiveChannelId,
  channelFilterId,
  routeIndex,
  setRouteIdForDeletion,
}) => {
  const { alertReceiveChannelStore } = useStore();
  const channelFilter = alertReceiveChannelStore.channelFilters[channelFilterId];
  const channelFiltersTotal = Object.keys(alertReceiveChannelStore.channelFilters);

  return (
    <HorizontalGroup spacing={'xs'}>
      {routeIndex > 0 && !channelFilter.is_default && (
        <WithPermissionControlTooltip userAction={UserActions.IntegrationsWrite}>
          <Tooltip placement="top" content={'Move Up'}>
            <Button variant={'secondary'} onClick={onRouteMoveUp} icon={'arrow-up'} size={'sm'} />
          </Tooltip>
        </WithPermissionControlTooltip>
      )}

      {routeIndex < channelFiltersTotal.length - 2 && !channelFilter.is_default && (
        <WithPermissionControlTooltip userAction={UserActions.IntegrationsWrite}>
          <Tooltip placement="top" content={'Move Down'}>
            <Button variant={'secondary'} onClick={onRouteMoveDown} icon={'arrow-down'} size={'sm'} />
          </Tooltip>
        </WithPermissionControlTooltip>
      )}

      {!channelFilter.is_default && (
        <WithPermissionControlTooltip userAction={UserActions.IntegrationsWrite}>
          <Tooltip placement="top" content={'Delete'}>
            <Button variant={'secondary'} icon={'trash-alt'} size={'sm'} onClick={setRouteIdForDeletion} />
          </Tooltip>
        </WithPermissionControlTooltip>
      )}
    </HorizontalGroup>
  );

  function onRouteMoveDown() {
    alertReceiveChannelStore.moveChannelFilterToPosition(alertReceiveChannelId, routeIndex, routeIndex + 1);
  }

  function onRouteMoveUp() {
    alertReceiveChannelStore.moveChannelFilterToPosition(alertReceiveChannelId, routeIndex, routeIndex - 1);
  }
};

export default ExpandedIntegrationRouteDisplay;
