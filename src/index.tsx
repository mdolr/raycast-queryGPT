import { Form, ActionPanel, Action, showToast, useNavigation } from '@raycast/api';
import { useState } from 'react';
import { getData } from './api';

import Chart from './chart';
import Table from './table';

type Values = {
  textfield: string;
  textarea: string;
  datepicker: Date;
  checkbox: boolean;
  dropdown: string;
  tokeneditor: string[];
};

export default function Command() {
  const { push } = useNavigation();

  // loading state
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(values: Values) {
    setIsLoading(true);
    showToast({ title: 'Submitted form', message: 'See logs for submitted values' });

    const data = await getData(values.textarea);
    setIsLoading(false);
    push(<Chart data={data} />);
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm onSubmit={handleSubmit} />
        </ActionPanel>
      }
      isLoading={isLoading}
    >
      <Form.TextArea
        id="textarea"
        title="Ask your question"
        placeholder="Enter your question in english as precisely as possible"
      />
    </Form>
  );
}
