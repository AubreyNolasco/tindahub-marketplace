-- Same class of gap as the follow/chat notification fixes earlier
-- today: a new product review has no natural feed a merchant would
-- otherwise see (unlike orders, which they poll on their own Orders
-- page) short of manually opening Merchant > Reviews & Ratings. AFTER
-- INSERT only, not UPDATE, so editing an existing review (the
-- ProductDetail.jsx "myReview" edit flow) doesn't re-notify on every
-- edit -- only the first time a reseller actually reviews the product.
-- Kept separate from trg_prepare_product_review (BEFORE INSERT OR
-- UPDATE, field validation/prep) rather than folded into it: that
-- trigger runs on both insert and update and runs before the row
-- exists, neither of which fits a "notify once, after the row is
-- real" side effect.
create or replace function public.notify_merchant_of_new_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_merchant_id uuid;
  v_product_name text;
begin
  select merchant_id, name into v_merchant_id, v_product_name from public.products where id = new.product_id;
  if v_merchant_id is not null then
    perform public.create_notification(
      v_merchant_id, 'review',
      format('New %s-star review', new.rating),
      format('%s left a review on %s.', coalesce(new.reviewer_name, 'A reseller'), coalesce(v_product_name, 'your product')),
      '/merchant/reviews',
      jsonb_build_object('product_id', new.product_id, 'rating', new.rating)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_merchant_of_new_review on public.product_reviews;
create trigger trg_notify_merchant_of_new_review
  after insert on public.product_reviews
  for each row execute function public.notify_merchant_of_new_review();
