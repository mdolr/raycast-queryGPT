import { Action, ActionPanel, Detail, useNavigation, useUnstableAI } from '@raycast/api';
import { useEffect } from 'react';

export default function Chart(props: { data: any }) {
  const { pop } = useNavigation();

  const markdown = props.data.markdown;

  return (
    <Detail
      markdown={markdown}
      actions={
        <ActionPanel>
          <Action title="Back" onAction={pop} />
        </ActionPanel>
      }
    />
  );
}
