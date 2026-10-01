import { Client } from '@elastic/elasticsearch';
import dotenv from 'dotenv';

dotenv.config();

export const esClient = new Client({
  node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
});

const INDEX_NAME = 'emails';

export const initElasticsearch = async () => {
  try {
    const exists = await esClient.indices.exists({ index: INDEX_NAME });
    if (!exists) {
      await esClient.indices.create({
        index: INDEX_NAME,
        mappings: {
          properties: {
            id: { type: 'keyword' },
            userId: { type: 'keyword' },
            senderId: { type: 'keyword' },
            senderEmail: { type: 'keyword' },
            recipient: { type: 'keyword' },
            subject: { type: 'text' },
            body: { type: 'text' },
            status: { type: 'keyword' },
            scheduledAt: { type: 'date' },
            sentAt: { type: 'date' },
            createdAt: { type: 'date' },
          },
        },
      });
      console.log(`[Elasticsearch] Created index: ${INDEX_NAME}`);
    } else {
      console.log(`[Elasticsearch] Index ${INDEX_NAME} already exists.`);
    }
  } catch (error: any) {
    console.error(`[Elasticsearch] Failed to initialize index:`, error.message);
  }
};

export const indexEmail = async (email: any) => {
  try {
    await esClient.index({
      index: INDEX_NAME,
      id: email.id,
      document: {
        id: email.id,
        userId: email.sender?.userId || '',
        senderId: email.senderId,
        senderEmail: email.sender?.emailAddress || '',
        recipient: email.recipient,
        subject: email.subject,
        body: email.body,
        status: email.status,
        scheduledAt: email.scheduledAt,
        sentAt: email.sentAt,
        createdAt: email.createdAt,
      },
    });
  } catch (error: any) {
    console.error(`[Elasticsearch] Failed to index email ${email.id}:`, error.message);
  }
};

export const updateEmailStatusInIndex = async (id: string, status: string, sentAt?: Date) => {
  try {
    await esClient.update({
      index: INDEX_NAME,
      id: id,
      doc: {
        status,
        ...(sentAt && { sentAt }),
      },
    });
  } catch (error: any) {
    console.error(`[Elasticsearch] Failed to update email ${id}:`, error.message);
  }
};

export const searchEmails = async (query: string, userId: string, page = 1, pageSize = 20) => {
  try {
    const from = (page - 1) * pageSize;
    const response = await esClient.search({
      index: INDEX_NAME,
      from,
      size: pageSize,
      query: {
        bool: {
          must: {
            multi_match: {
              query,
              fields: ['recipient', 'subject', 'body', 'senderEmail'],
              fuzziness: 'AUTO',
            },
          },
          filter: {
            term: {
              userId: userId
            }
          }
        }
      },
    });

    const total = typeof response.hits.total === 'number' 
      ? response.hits.total 
      : response.hits.total?.value || 0;

    const data = response.hits.hits.map((hit: any) => hit._source);

    return {
      data,
      total,
      page,
      pageSize,
    };
  } catch (error: any) {
    console.error(`[Elasticsearch] Search failed:`, error.message);
    throw new Error('Elasticsearch search failed');
  }
};
