# Founders Weekly Sync
**Date**: February 9, 2024
**Attendees**: Henry, Steven

## Updates

### Henry Updates
- Signed ConsultPro last week! They're an engineering consulting firm, 40 employees, much bigger than BuildCorp.
- Also signed DesignHub, a small architecture firm. They're only 8 people but good revenue diversity.
- ConsultPro is demanding. They want detailed API docs, SSO, and advanced reporting. They're paying $99/month but expecting enterprise features.
- I'm realizing our pricing is broken. ConsultPro is way more demanding than BuildCorp but paying the same.

### Steven Updates
- BuildCorp continues to be happy. No issues, no support tickets, just working great.
- ConsultPro onboarding is rough. Their datasets are huge—thousands of historical estimates they want to import. Performance is slowing down.
- I'm seeing database query times spike when ConsultPro users are active. Might need to optimize some queries.
- The API work is taking longer than I thought. It's not just building endpoints, it's thinking through authentication, rate limiting, versioning...

## Discussion

Henry: Should we charge ConsultPro more? They're clearly an enterprise customer.

Steven: We can't change pricing on them mid-contract. But yes, for future customers we need tiers. Small businesses vs enterprises need different pricing.

Henry: What if we do three tiers? Starter at $99, Professional at $299, Enterprise at $999?

Steven: What's the difference between tiers? Just user count or actual features?

Henry: Both. Starter gets basic features, up to 10 users. Professional gets API access, 50 users. Enterprise gets everything, unlimited users, priority support.

Steven: I like it but we need to build those features first. We don't have SSO, we barely have an API, and I'm the only person doing support.

Henry: You're right. Let's plan to introduce new pricing in April. Gives us two months to build out the differentiating features. ConsultPro and BuildCorp get grandfathered at $99.

Steven: Deal. But I'm worried about the performance issues. If we sign more customers like ConsultPro, the system will crawl.

## Action Items
- Henry: Draft new pricing tiers for April launch
- Steven: Investigate database performance issues, prioritize optimization
- Steven: Continue API development, target March for beta

