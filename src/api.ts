import { Client } from 'pg';
import ChartJSImage from 'chart.js-image';
import { Configuration, OpenAIApi } from 'openai';
import { getPreferenceValues } from '@raycast/api';

const DEBUG = false;
const settings = getPreferenceValues();

const configuration = new Configuration({
  apiKey: settings.openai_api_key,
});
const openai = new OpenAIApi(configuration);

const client = new Client({
  connectionString: settings.postgres_url,
});

client.connect();

export function makeTable(res, size = 3) {
  let sample = {};

  if (DEBUG) console.log(res.rows);

  // for key in res.rows[0] {
  for (const column in res.rows[0]) {
    sample[column] = [];
  }

  let rowCount = 0;

  // for the first 3 rows append each column to the sample
  let y = 0;

  while (rowCount < Math.min(size, res.rowCount)) {
    // check that the row doesn't have a null value in any column
    let checkNull = true;
    for (const column in res.rows[y]) {
      if (res.rows[y][column] === null) {
        checkNull = false;
      }
    }

    if (checkNull) {
      for (const column in res.rows[y]) {
        sample[column].push(res.rows[y][column]);
      }

      rowCount++;
    }

    y += 1;
  }

  // Using the sample object, build a table using | and spacing, the table should be aligned
  // perfectly and look like this:
  // | column1 | column2 | column3 |
  // |---------|---------|---------|
  // | value1  | value2  | value3  |
  // the spaces should be determined based on the longest string in each column
  // the table should be returned as a string

  let maximumLength = {};

  for (const column in sample) {
    maximumLength[column] = Math.max(...sample[column].map((x) => x.length), column.length);
  }

  let table = '\n';

  for (const column in sample) {
    table += '| ' + column + ' '.padEnd(maximumLength[column] - column.length + 1);
  }
  table += '|\n';

  // repeat '-' for total length of table based on maximumLength
  for (const column in sample) {
    table += '|-' + '-'.padEnd(maximumLength[column] + 1, '-');
  }
  table += '|\n';

  // add each row to the table
  for (let i = 0; i < rowCount; i++) {
    for (const column in sample) {
      table += '| ' + sample[column][i] + ' '.padEnd(maximumLength[column] - sample[column][i].length + 1);
    }
    table += '|\n';
  }

  return table;
}

export async function getData(question: string) {
  if (question.length < 3) {
    return {
      data: null,
      markdown: 'The question is too short, please write a question with at least 3 characters',
    };
  }

  const prompt = `
Given the following PostgreSQL Database "producthunt-trends" containing data about ProductHunt.com launches with the following tables on schema "public" :
- "product" (id: TEXT, name: TEXT, "featuredAt": DATE, "createdAt": DATE, description: TEXT, rank: INTEGER, day: INTEGER, month: INTEGER, year: INTEGER, tagline: TEXT) which represents a product launched on ProductHunt.com 
- "topic" (id: TEXT, name: TEXT, description: TEXT) which represents ProductHunt.com topics
- "product_topic" (id: UUID, "productId": TEXT, "topicId": TEXT) which represents a many-to-many relation between tables "topic" and "product" respectively on "product_topic"."topicId" = "topic".id and "product_topic"."productId" = "product".id 

Write a SQL Query to gather data in order to answer the following question: "${question}"

With the following rules:
- The SQL Query should respect the case and consider columns and tables as case-sensitive
- The SQL Query should use quotes around table and column names containing uppercase characters
- The SQL Query should be read-only
- The SQL Query should be syntaxically correct
- The SQL Query should be the sole content of your message

Query:
  `;

  let messages: any = [
    {
      role: 'user',
      content: prompt,
    },
  ];

  let completion = await openai.createChatCompletion({
    model: 'gpt-3.5-turbo',
    messages: messages,
  });

  const query = completion.data.choices[0].message?.content;
  messages.push(completion.data.choices[0].message);
  if (DEBUG) console.log(query);

  const res = await client.query(query);
  if (DEBUG) console.log(res.rows);

  const typePrompt = `
  The previous SQL Query:
  \`\`\`SQL
  ${query}
  \`\`\`
  
  Returned ${res.rowCount} row(s) in total, here is table showing a sample of the first few rows:
  ${makeTable(res, 3)}

  What is the most appropriate representation type to best represent this data, either as a simple sentence describing the results, as a table or as a chart ? Reply with either "sentence", "table" or "chart" and nothing more.
  
  Rules:
  - The type should either be "table", "sentence" or "chart"
  - The type should not exceed one word

  Type:
  `;

  if (DEBUG) console.log(typePrompt);

  messages.push({
    role: 'user',
    content: typePrompt,
  });

  completion = await openai.createChatCompletion({
    model: 'gpt-3.5-turbo',
    messages: messages,
  });

  const type = completion.data.choices[0].message?.content;
  messages.push(completion.data.choices[0].message);
  if (DEBUG) console.log(type);

  if (type == 'chart') {
    const chartObjectPrompt = `
The rows generated by the query are stored in a list format at \`res.rows\`

Generate the most appropriate chart using the chart.js library

Rules:
- The JS object should generate colors randomly for backgroundColors and other field about colors
- The JS object should be top level and structured as 
\`\`\`js
{
  type: string,
  data: {
   labels: list, // generate list dynamically from res.rows
   datasets: [{
     data: list, // generate list dynamically from res.rows
   }]
  },
  options: object, // asign options.title.text and others dynamically
}
\`\`\`
- This js object should be the sole content of the message, there should be no intermediate variables
- The JS object should make use of data from the \`res.rows\` object to handle labels, datasets, axes title and others
- The JS object should start with { and end with }
- The JS object should be syntaxically correct

JS Object:
`;

    messages.push({
      role: 'user',
      content: chartObjectPrompt,
    });

    completion = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages: messages,
    });

    if (DEBUG) console.log(completion.data.choices[0].message?.content);

    let chartObject: any = completion.data.choices[0].message?.content;

    chartObject = chartObject.replace('```js\n', '').replace(/```/g, '');

    messages.push(completion.data.choices[0].message);
    if (DEBUG) console.log(chartObject);

    const chart = ChartJSImage()
      .chart(eval(`(() => { return ${chartObject}; })()`)) // Line chart
      .backgroundColor('transparent')
      .width(800) // 500px
      .height(350); // 300px

    const image = await chart.toDataURI();

    return {
      data: res.rows,
      markdown: `## Chart\n![](${image})\n\n### Query\n\`\`\`SQL\n${query}\n\`\`\``,
    };
  }

  // Else
  else if (type == 'table') {
    return {
      data: res.rows,
      markdown: `## Table\n${makeTable(res, res.rowCount)}\n\n### Query\n\`\`\`SQL\n${query}\n\`\`\``,
    };
  } else {
    const sentencePrompt = `Using the previously given sample of results make a human-sounding sentence replying to the initial question which was: "${question}"
    
    The results should be highlighted in bold by adding ** around them.

    Sentence:
    `;

    messages.push({
      role: 'user',
      content: sentencePrompt,
    });

    completion = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages: messages,
    });

    const sentence = completion.data.choices[0].message?.content;
    messages.push(completion.data.choices[0].message);

    return {
      data: res.rows,
      markdown: `## Result\n ${sentence}\n\n### Query\n\`\`\`SQL\n${query}\n\`\`\``,
    };
  }
}
