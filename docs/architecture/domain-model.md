# Domain Model

## User

- `id`
- `email`
- `createdAt`

## Trip

- `id`
- `ownerId`
- `title`
- `description`
- `startDate` optional
- `endDate` optional
- `status`
- `createdAt`
- `updatedAt`

## Stop

- `id`
- `tripId`
- `orderIndex`
- `cityName`
- `regionName` optional
- `countryName`
- `latitude`
- `longitude`
- `stayNights` optional
- `notes` optional

## Leg

- `id`
- `tripId`
- `fromStopId`
- `toStopId`
- `orderIndex`
- `transportType`
- `vehicleLabel` optional
- `notes` optional

## TransportType

- Plane
- Bus
- Ferry
- Train
- Car
- Custom

## Future entities

- Accommodation
- Place visit
- Photo memory
- Shared collaborator
