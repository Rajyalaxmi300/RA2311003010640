# Notification System Design
**Campus Notifications Microservice – Backend Evaluation**

---

# Stage 1

## Overview
A campus notification system where students receive real-time updates for:
- Placements
- Events
- Results

This system exposes REST APIs for managing notifications.

---

## Core Endpoints

### 1. Get All Notifications
GET /notifications  
Headers: Authorization: Bearer <token>

Response:
{
  "notifications": [
    {
      "id": "uuid",
      "type": "Placement",
      "message": "Amazon is hiring",
      "isRead": false,
      "createdAt": "2026-04-22T17:51:30Z"
    }
  ]
}

---

### 2. Get Single Notification
GET /notifications/:id

Response:
{
  "id": "uuid",
  "type": "Placement",
  "message": "Amazon is hiring",
  "isRead": false,
  "createdAt": "timestamp"
}

---

### 3. Create Notification
POST /notifications

Body:
{
  "type": "Placement",
  "message": "Google hiring",
  "studentIds": ["all"]
}

---

### 4. Mark as Read
PATCH /notifications/:id/read

---

### 5. Mark All as Read
PATCH /notifications/read-all

---

### 6. Delete Notification
DELETE /notifications/:id

---

## Real-Time System

Chosen: **Server-Sent Events (SSE)**

Reason:
- Simple
- One-way communication
- Auto reconnect
- No WebSocket complexity

---

# Stage 2

## Database Choice: PostgreSQL

### Why PostgreSQL?
- Structured data
- Strong consistency (ACID)
- Supports indexing and partitioning
- Efficient querying

### Schema

CREATE TABLE notifications (
  id UUID PRIMARY KEY,
  studentId INT,
  type TEXT,
  message TEXT,
  isRead BOOLEAN,
  createdAt TIMESTAMP
);

---

## Scaling Problems

1. Slow queries without indexing  
2. Large data size  
3. Write bottlenecks  
4. Sorting inefficiency  

---

## Solutions

- Indexing
- Partitioning
- Archiving old data
- Read replicas

---

# Stage 3

## Problem Query

SELECT * FROM notifications
WHERE studentId = 1042 AND isRead = false
ORDER BY createdAt DESC;

---

## Issues

1. SELECT * → unnecessary data
2. No index → full table scan

---

## Optimized Query

SELECT id, type, message, createdAt
FROM notifications
WHERE studentId = 1042 AND isRead = false
ORDER BY createdAt DESC;

---

## Index

CREATE INDEX idx_notifications
ON notifications (studentId, isRead, createdAt DESC);

---

# Stage 4

## Problem
Heavy DB load when users fetch notifications frequently.

---

## Solutions

### 1. Redis Caching
- Cache notifications per user
- TTL = 60 seconds

### 2. Pagination
GET /notifications?page=1&limit=20

### 3. Read Replicas
- Separate read & write DB

---

# Stage 5

## Problem with Given Code

- Sequential execution (slow)
- No retry
- Tight coupling

---

## Solution: Queue-Based System

Flow:
API → Queue → Workers

Worker Tasks:
1. Save to DB
2. Send email
3. Push notification

---

## Benefits

- Parallel execution
- Retry mechanism
- Fault tolerance

---

# Stage 6

## Priority Logic

Priority depends on:
- Type weight
- Timestamp

Weights:
Placement = 3  
Result = 2  
Event = 1  

---

## Score Formula

score = type_weight × 10^12 + timestamp

---

## Algorithm

1. Fetch notifications
2. Calculate score
3. Sort descending
4. Return top N

---

## Optimization

Use **Min Heap (size 10)**

Benefits:
- O(log n)
- Efficient updates
- No full sorting required

---

# Conclusion

This system:
- Uses scalable architecture
- Handles real-time notifications
- Optimizes performance using caching and indexing
- Ensures reliability using queues

---