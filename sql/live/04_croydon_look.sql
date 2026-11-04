-- Run this any time, in a NEW query. It gives Croydon the Maroondah City Council colours, and keeps its logo.
-- Main colour blue, highlight amber. The prize buttons use the Council's green, blue, orange and amber.
-- It does not touch any customers. You can also change all of this any time in Admin, under Look and Prizes.

update areas
set brand = brand || jsonb_build_object('color', '#006BB6', 'accent', '#FCBF45', 'logo', '/img/croydon-logo.svg')
where id = 'croydon';

update prizes set color = '#03AD50' where area = 'croydon' and name = 'Chocolate bar';
update prizes set color = '#FCBF45' where area = 'croydon' and name = 'Bubbles';
update prizes set color = '#006BB6' where area = 'croydon' and name = '$5 coupon';
update prizes set color = '#F5813B' where area = 'croydon' and name = '$10 coupon';
update prizes set color = '#03AD50' where area = 'croydon' and name = '$50 coupon';
