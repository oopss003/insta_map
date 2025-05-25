import axios from 'axios';

export default async function handler(req, res) {
  const { query } = req.query;

  const CLIENT_ID     = 'qpbrmxiff4';
  const CLIENT_SECRET = 'mymd8vVOsm59IHlwczl0MDyOEFDiI3D4kpRIgaUW';

  try {
    const resp = await axios.get(
      `https://naveropenapi.apigw.ntruss.com/map-geocode/v2/geocode?query=${encodeURIComponent(query)}`,
      {
        headers: {
          'X-NCP-APIGW-API-KEY-ID': CLIENT_ID,
          'X-NCP-APIGW-API-KEY'   : CLIENT_SECRET
        }
      }
    );
    res.status(200).json(resp.data);
  } catch (err) {
    res.status(500).json({ error: 'Geocode failed' });
  }
}
