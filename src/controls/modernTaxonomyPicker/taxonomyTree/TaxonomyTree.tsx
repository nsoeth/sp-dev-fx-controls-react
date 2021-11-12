import * as React from 'react';
import { Checkbox,
         ChoiceGroup,
         css,
         FocusZone,
         FocusZoneDirection,
         getRTLSafeKeyCode,
         GroupedList,
         GroupHeader,
         ICheckboxStyleProps,
         ICheckboxStyles,
         IChoiceGroupOption,
         IChoiceGroupOptionStyleProps,
         IChoiceGroupOptionStyles,
         IChoiceGroupStyleProps,
         IChoiceGroupStyles,
         IGroup,
         IGroupFooterProps,
         IGroupHeaderProps,
         IGroupHeaderStyleProps,
         IGroupHeaderStyles,
         IGroupRenderProps,
         IGroupShowAllProps,
         ILabelStyleProps,
         ILabelStyles,
         ILinkStyleProps,
         ILinkStyles,
         IListProps,
         IRenderFunction,
         ISpinnerStyleProps,
         ISpinnerStyles,
         IStyleFunctionOrObject,
         KeyCodes,
         Label,
         Link,
         Selection,
         Spinner
       } from 'office-ui-fabric-react';
import * as strings from 'ControlStrings';
import { IReadonlyTheme } from '@microsoft/sp-component-base';
import { Guid } from '@microsoft/sp-core-library';
import { ITermInfo, ITermSetInfo, ITermStoreInfo } from '@pnp/sp/taxonomy';
import styles from './TaxonomyTree.module.scss';

export interface ITaxonomyTreeProps {
  allowMultipleSelections?: boolean;
  pageSize: number;
  onLoadMoreData: (termSetId: Guid, parentTermId?: Guid, skiptoken?: string, hideDeprecatedTerms?: boolean, pageSize?: number) => Promise<{ value: ITermInfo[], skiptoken: string }>;
  anchorTermInfo?: ITermInfo;
  termSetInfo: ITermSetInfo;
  termStoreInfo: ITermStoreInfo;
  languageTag: string;
  themeVariant?: IReadonlyTheme;
  onRenderActionButton?: (termStoreInfo: ITermStoreInfo, termSetInfo: ITermSetInfo, termInfo?: ITermInfo) => JSX.Element;
  terms: ITermInfo[];
  setTerms: React.Dispatch<React.SetStateAction<ITermInfo[]>>;
  selection?: Selection<any>;
}

export function TaxonomyTree(props: ITaxonomyTreeProps): React.ReactElement<ITaxonomyTreeProps> {
  const [groupsLoading, setGroupsLoading] = React.useState<string[]>([]);
  const [groups, setGroups] = React.useState<IGroup[]>([]);

  React.useEffect(() => {
    let termRootName = "";
    if (props.anchorTermInfo) {
      let anchorTermNames = props.anchorTermInfo.labels.filter((name) => name.languageTag === props.languageTag && name.isDefault);
      if (anchorTermNames.length === 0) {
        anchorTermNames = props.anchorTermInfo.labels.filter((name) => name.languageTag === props.termStoreInfo.defaultLanguageTag && name.isDefault);
      }
      termRootName = anchorTermNames[0].name;
    }
    else {
      let termSetNames = props.termSetInfo.localizedNames.filter((name) => name.languageTag === props.languageTag);
      if (termSetNames.length === 0) {
        termSetNames = props.termSetInfo.localizedNames.filter((name) => name.languageTag === props.termStoreInfo.defaultLanguageTag);
      }
      termRootName = termSetNames[0].name;
    }
    const rootGroup: IGroup = {
      name: termRootName,
      key: props.anchorTermInfo ? props.anchorTermInfo.id : props.termSetInfo.id,
      startIndex: -1,
      count: 50,
      level: 0,
      isCollapsed: false,
      data: { skiptoken: '' },
      hasMoreData: (props.anchorTermInfo ? props.anchorTermInfo.childrenCount : props.termSetInfo.childrenCount) > 0
    };
    setGroups([rootGroup]);
    setGroupsLoading((prevGroupsLoading) => [...prevGroupsLoading, props.termSetInfo.id]);
    if (props.termSetInfo.childrenCount > 0) {
      props.onLoadMoreData(Guid.parse(props.termSetInfo.id), props.anchorTermInfo ? Guid.parse(props.anchorTermInfo.id) : Guid.empty, '', true)
        .then((loadedTerms) => {
          const grps: IGroup[] = loadedTerms.value.map(term => {
            let termNames = term.labels.filter((termLabel) => (termLabel.languageTag === props.languageTag && termLabel.isDefault === true));
            if (termNames.length === 0) {
              termNames = term.labels.filter((termLabel) => (termLabel.languageTag === props.termStoreInfo.defaultLanguageTag && termLabel.isDefault === true));
            }
            const g: IGroup = {
              name: termNames[0]?.name,
              key: term.id,
              startIndex: -1,
              count: 50,
              level: 1,
              isCollapsed: true,
              data: { skiptoken: '', term: term },
              hasMoreData: term.childrenCount > 0,
            };
            if (g.hasMoreData) {
              g.children = [];
            }
            return g;
          });
          props.setTerms((prevTerms) => {
            const nonExistingTerms = loadedTerms.value.filter((term) => prevTerms.every((prevTerm) => prevTerm.id !== term.id));
            return [...prevTerms, ...nonExistingTerms];
          });
          rootGroup.children = grps;
          rootGroup.data.skiptoken = loadedTerms.skiptoken;
          rootGroup.hasMoreData = loadedTerms.skiptoken !== '';
          setGroupsLoading((prevGroupsLoading) => prevGroupsLoading.filter((value) => value !== props.termSetInfo.id));
          setGroups([rootGroup]);
        });
    }
  }, []);

  const onToggleCollapse = (group: IGroup): void => {
    if (group.isCollapsed === true) {
      setGroups((prevGroups) => {
        const recurseGroups = (currentGroup: IGroup) => {
          if (currentGroup.key === group.key) {
            currentGroup.isCollapsed = false;
          }
          if (currentGroup.children?.length > 0) {
            for (const child of currentGroup.children) {
              recurseGroups(child);
            }
          }
        };
        let newGroupsState: IGroup[] = [];
        for (const prevGroup of prevGroups) {
          recurseGroups(prevGroup);
          newGroupsState.push(prevGroup);
        }

        return newGroupsState;
      });

      if (group.children && group.children.length === 0) {
        setGroupsLoading((prevGroupsLoading) => [...prevGroupsLoading, group.key]);
        group.data.isLoading = true;

        props.onLoadMoreData(Guid.parse(props.termSetInfo.id), Guid.parse(group.key), '', true)
          .then((loadedTerms) => {
            const grps: IGroup[] = loadedTerms.value.map(term => {
              let termNames = term.labels.filter((termLabel) => (termLabel.languageTag === props.languageTag && termLabel.isDefault === true));
              if (termNames.length === 0) {
                termNames = term.labels.filter((termLabel) => (termLabel.languageTag === props.termStoreInfo.defaultLanguageTag && termLabel.isDefault === true));
              }
              const g: IGroup = {
                name: termNames[0]?.name,
                key: term.id,
                startIndex: -1,
                count: 50,
                level: group.level + 1,
                isCollapsed: true,
                data: { skiptoken: '', term: term },
                hasMoreData: term.childrenCount > 0,
              };
              if (g.hasMoreData) {
                g.children = [];
              }
              return g;
            });

            props.setTerms((prevTerms) => {
              const nonExistingTerms = loadedTerms.value.filter((term) => prevTerms.every((prevTerm) => prevTerm.id !== term.id));
              return [...prevTerms, ...nonExistingTerms];
            });

            group.children = grps;
            group.data.skiptoken = loadedTerms.skiptoken;
            group.hasMoreData = loadedTerms.skiptoken !== '';
            setGroupsLoading((prevGroupsLoading) => prevGroupsLoading.filter((value) => value !== group.key));
          });
      }
    }
    else {
      setGroups((prevGroups) => {
        const recurseGroups = (currentGroup: IGroup) => {
          if (currentGroup.key === group.key) {
            currentGroup.isCollapsed = true;
          }
          if (currentGroup.children?.length > 0) {
            for (const child of currentGroup.children) {
              recurseGroups(child);
            }
          }
        };
        let newGroupsState: IGroup[] = [];
        for (const prevGroup of prevGroups) {
          recurseGroups(prevGroup);
          newGroupsState.push(prevGroup);
        }

        return newGroupsState;
      });

    }
  };

  const onRenderTitle = (groupHeaderProps: IGroupHeaderProps) => {
    const isChildSelected = (children: IGroup[]): boolean => {
      let aChildIsSelected = children && children.some((child) => props.selection.isKeySelected(child.key) || isChildSelected(child.children));
      return aChildIsSelected;
    };

    const childIsSelected = props.selection && isChildSelected(groupHeaderProps.group.children);

    if (groupHeaderProps.group.level === 0) {
      const labelStyles: IStyleFunctionOrObject<ILabelStyleProps, ILabelStyles> = {root: {width: "100%", fontWeight: childIsSelected ? "bold" : "normal"}};
      return (
        <FocusZone
          direction={FocusZoneDirection.horizontal}
          className={styles.taxonomyItemFocusZone}
        >
          <Label styles={labelStyles}>{groupHeaderProps.group.name}</Label>
          <div className={styles.actionButtonContainer}>
            {props.onRenderActionButton && props.onRenderActionButton(props.termStoreInfo, props.termSetInfo, props.anchorTermInfo)}
          </div>
        </FocusZone>
      );
    }

    if (!props.selection) {
      const labelStyles: IStyleFunctionOrObject<ILabelStyleProps, ILabelStyles> = {root: {width: "100%", fontWeight: childIsSelected ? "bold" : "normal"}};
      return (
        <FocusZone
          direction={FocusZoneDirection.horizontal}
          className={styles.taxonomyItemFocusZone}
        >
          <Label styles={labelStyles}>{groupHeaderProps.group.name}</Label>
          <div className={styles.actionButtonContainer}>
            {props.onRenderActionButton && props.onRenderActionButton(props.termStoreInfo, props.termSetInfo, groupHeaderProps.group.data.term)}
          </div>
        </FocusZone>
      );
    }

    const isDisabled = groupHeaderProps.group.data.term.isAvailableForTagging.filter((t) => t.setId === props.termSetInfo.id)[0].isAvailable === false;
    const isSelected = props.selection.isKeySelected(groupHeaderProps.group.key);

    if (props.allowMultipleSelections) {
      const checkBoxStyles: IStyleFunctionOrObject<ICheckboxStyleProps, ICheckboxStyles> = {root: { flex: "1" } };
      if (isSelected || childIsSelected) {
        checkBoxStyles.label = { fontWeight: 'bold' };
      }
      else {
        checkBoxStyles.label = { fontWeight: 'normal' };
      }

      return (
        <FocusZone
          direction={FocusZoneDirection.horizontal}
          className={styles.taxonomyItemFocusZone}
        >
          <Checkbox
            key={groupHeaderProps.group.key}
            label={groupHeaderProps.group.name}
            checked={isSelected}
            styles={checkBoxStyles}
            disabled={isDisabled}
            onRenderLabel={(p) => <span className={css(!isDisabled && styles.checkbox, isDisabled && styles.disabledCheckbox, isSelected && styles.selectedCheckbox)} title={p.title}>
              {p.label}
            </span>}
            onChange={(ev?: React.FormEvent<HTMLElement | HTMLInputElement>, checked?: boolean) => {
              props.selection.setKeySelected(groupHeaderProps.group.key, checked, false);
            }}
          />
          <div className={styles.actionButtonContainer}>
            {props.onRenderActionButton && props.onRenderActionButton(props.termStoreInfo, props.termSetInfo, groupHeaderProps.group.data.term)}
          </div>
        </FocusZone>
      );
    }
    else {
      const choiceGroupOptionStyles: IStyleFunctionOrObject<IChoiceGroupOptionStyleProps, IChoiceGroupOptionStyles> = isSelected || childIsSelected ? { root: {marginTop: 0}, choiceFieldWrapper: { fontWeight: 'bold', flex: '1' }, field: { width: '100%'} } : { root: {marginTop: 0}, choiceFieldWrapper: { fontWeight: 'normal', flex: '1' }, field: { width: '100%'} };
      const options: IChoiceGroupOption[] = [{
                                                key: groupHeaderProps.group.key,
                                                text: groupHeaderProps.group.name,
                                                styles: choiceGroupOptionStyles,
                                                onRenderLabel: (p) =>
                                                  <span id={p.labelId} className={css(!isDisabled && styles.choiceOption, isDisabled && styles.disabledChoiceOption, isSelected && styles.selectedChoiceOption)}>
                                                    {p.text}
                                                  </span>,
                                                onClick: () => {
                                                  props.selection.setAllSelected(false);
                                                  props.selection.setKeySelected(groupHeaderProps.group.key, true, false);
                                                }
                                              }];

      const choiceGroupStyles: IStyleFunctionOrObject<IChoiceGroupStyleProps, IChoiceGroupStyles> = { root: { flex: "1" }, applicationRole: { width: "100%" } };

      return (
        <FocusZone
          direction={FocusZoneDirection.horizontal}
          className={styles.taxonomyItemFocusZone}
        >
            <ChoiceGroup
              options={options}
              selectedKey={props.selection.getSelection()[0]?.id}
              disabled={isDisabled}
              styles={choiceGroupStyles}
            />
          <div className={styles.actionButtonContainer}>
            {props.onRenderActionButton && props.onRenderActionButton(props.termStoreInfo, props.termSetInfo, groupHeaderProps.group.data.term)}
          </div>
        </FocusZone>
      );
    }
  };

  const onRenderHeader = (headerProps: IGroupHeaderProps): JSX.Element => {
    const groupHeaderStyles: IStyleFunctionOrObject<IGroupHeaderStyleProps, IGroupHeaderStyles> = {
      expand: { height: 42, visibility: !headerProps.group.children || headerProps.group.level === 0 ? "hidden" : "visible", fontSize: 14 },
      expandIsCollapsed: { visibility: !headerProps.group.children || headerProps.group.level === 0 ? "hidden" : "visible", fontSize: 14 },
      check: { display: 'none' },
      headerCount: { display: 'none' },
      groupHeaderContainer: { height: 36, paddingTop: 3, paddingBottom: 3, paddingLeft: 3, paddingRight: 3, alignItems: 'center', },
      root: { height: 42 },
    };

    const isDisabled = headerProps.group.data.term && headerProps.group.data.term.isAvailableForTagging.filter((t) => t.setId === props.termSetInfo.id)[0].isAvailable === false;

    return (
      <GroupHeader
        {...headerProps}
        styles={groupHeaderStyles}
        className={styles.taxonomyItemHeader}
        onRenderTitle={onRenderTitle}
        onToggleCollapse={onToggleCollapse}
        indentWidth={20}
        expandButtonProps={{style: {color: props.themeVariant?.semanticColors.bodyText}}}
        onGroupHeaderKeyUp={(ev: React.KeyboardEvent<HTMLElement>, group: IGroup) => {
          if ((ev.key == " " || ev.key == "Enter" ) && !isDisabled) {
            if (props.allowMultipleSelections) {
              props.selection.toggleKeySelected(headerProps.group.key);
            }
            else {
              props.selection.setAllSelected(false);
              props.selection.setKeySelected(headerProps.group.key, true, false);
            }
          }
        }}
      />
    );
  };

  const onRenderFooter = (footerProps: IGroupFooterProps): JSX.Element => {
    if ((footerProps.group.hasMoreData || footerProps.group.children && footerProps.group.children.length === 0) && !footerProps.group.isCollapsed) {

      if (groupsLoading.some(value => value === footerProps.group.key)) {
        const spinnerStyles: IStyleFunctionOrObject<ISpinnerStyleProps, ISpinnerStyles> = { circle: { verticalAlign: 'middle' } };
        return (
          <div className={styles.spinnerContainer}>
            <Spinner styles={spinnerStyles} />
          </div>
        );
      }
      const linkStyles: IStyleFunctionOrObject<ILinkStyleProps, ILinkStyles> = { root: { fontSize: '14px', paddingLeft: (footerProps.groupLevel + 1) * 20 + 62 } };
      return (
        <div className={styles.loadMoreContainer}>
          <Link onClick={() => {
            setGroupsLoading((prevGroupsLoading) => [...prevGroupsLoading, footerProps.group.key]);
            props.onLoadMoreData(Guid.parse(props.termSetInfo.id), footerProps.group.key === props.termSetInfo.id ? Guid.empty : Guid.parse(footerProps.group.key), footerProps.group.data.skiptoken, true)
              .then((loadedTerms) => {
                const grps: IGroup[] = loadedTerms.value.map(term => {
                  let termNames = term.labels.filter((termLabel) => (termLabel.languageTag === props.languageTag && termLabel.isDefault === true));
                  if (termNames.length === 0) {
                    termNames = term.labels.filter((termLabel) => (termLabel.languageTag === props.termStoreInfo.defaultLanguageTag && termLabel.isDefault === true));
                  }
                  const g: IGroup = {
                    name: termNames[0]?.name,
                    key: term.id,
                    startIndex: -1,
                    count: 50,
                    level: footerProps.group.level + 1,
                    isCollapsed: true,
                    data: { skiptoken: '', term: term },
                    hasMoreData: term.childrenCount > 0,
                  };
                  if (g.hasMoreData) {
                    g.children = [];
                  }
                  return g;
                });
                props.setTerms((prevTerms) => {
                  const nonExistingTerms = loadedTerms.value.filter((term) => prevTerms.every((prevTerm) => prevTerm.id !== term.id));
                  return [...prevTerms, ...nonExistingTerms];
                });
                footerProps.group.children = [...footerProps.group.children, ...grps];
                footerProps.group.data.skiptoken = loadedTerms.skiptoken;
                footerProps.group.hasMoreData = loadedTerms.skiptoken !== '';
                setGroupsLoading((prevGroupsLoading) => prevGroupsLoading.filter((value) => value !== footerProps.group.key));
              });
          }}
            styles={linkStyles}>
            {strings.ModernTaxonomyPickerLoadMoreText}
          </Link>
        </div>
      );
    }
    return null;
  };

  const onRenderShowAll: IRenderFunction<IGroupShowAllProps> = () => {
    return null;
  };

  const groupProps: IGroupRenderProps = {
    onRenderFooter: onRenderFooter,
    onRenderHeader: onRenderHeader,
    showEmptyGroups: true,
    onRenderShowAll: onRenderShowAll,
  };

  const shouldEnterInnerZone = (ev: React.KeyboardEvent<HTMLElement>): boolean => {
    return ev.which === getRTLSafeKeyCode(KeyCodes.right);
  };

  return (
    <div>
      <GroupedList
        items={[]}
        onRenderCell={null}
        groups={groups}
        groupProps={groupProps}
        onShouldVirtualize={(p: IListProps<any>) => false}
        data-is-focusable={true}
        focusZoneProps={{direction: FocusZoneDirection.vertical, shouldEnterInnerZone: shouldEnterInnerZone}}
      />
    </div>
  );
}
