import app from './app';
import dotenv from 'dotenv';
dotenv.config();

import { initElasticsearch } from './integrations/elasticsearch/elasticsearch.service';

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  await initElasticsearch();
  console.log(`Server is running on port ${PORT}`);
});
