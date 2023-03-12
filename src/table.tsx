import { Color, Icon, List } from '@raycast/api';

export default function Table() {
  return (
    <List>
      <List.Item
        title="An Item with Accessories"
        accessories={[
          { text: `An Accessory Text`, icon: Icon.Hammer },
          { text: { value: `A Colored Accessory Text`, color: Color.Orange }, icon: Icon.Hammer },
          { icon: Icon.Person, tooltip: 'A person' },
          { text: 'Just Do It!' },
          { date: new Date() },
          { tag: new Date() },
          { tag: { value: new Date(), color: Color.Magenta } },
          { tag: { value: 'User', color: Color.Magenta }, tooltip: 'Tag with tooltip' },
        ]}
      />
    </List>
  );
}
