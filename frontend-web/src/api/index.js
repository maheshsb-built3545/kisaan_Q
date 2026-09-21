import apiClient, { farmerClient, staffClient, BASE_URL } from './client';

export { apiClient, farmerClient, staffClient, BASE_URL };
export { authApi } from './auth.api';
export { centresApi } from './centres.api';
export { bookingsApi } from './bookings.api';
export { queueApi } from './queue.api';
export { procurementApi } from './procurement.api';
export { exceptionsApi } from './exceptions.api';
export { adminApi } from './admin.api';
export { auditApi } from './audit.api';
export { notificationsApi } from './notifications.api';
export { staffNotificationsApi } from './staffNotifications.api';
export { pricesApi } from './prices.api';
export { fastTrackApi, staffFastTrackApi } from './fastTrack.api';
export { voiceBookingApi } from './voiceBooking.api';
export { waitlistApi, staffWaitlistApi } from './waitlist.api';
export { complaintsApi, staffComplaintsApi } from './complaints.api';
export { farmerApi } from './farmer.api';

export default apiClient;
