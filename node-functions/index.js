import { handleRequest } from '../src/edgeone/app.js';

export default async function onRequest(context) {
  return handleRequest(context);
}
