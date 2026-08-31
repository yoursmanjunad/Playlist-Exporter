# Ship Your Playlists
This is an open-source project to transport all your playlists from `Spotify` to `YouTube`.

## API documentation

The complete OpenAPI 3.1 contract and integration guide are in [docs/API.md](docs/API.md). Import [docs/openapi.yaml](docs/openapi.yaml) into Postman, Insomnia, or Swagger UI.


Development Plan for Matching Engine
- Done with fetching user's spotify playlists and tracks.
This is how the matching engine works. 
- User selects the playlist. 
- Pull those tracks and save to DB
- Build a query for each song and save them to DB
