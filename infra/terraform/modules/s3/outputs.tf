output "photos_bucket_name" {
  value = aws_s3_bucket.photos.id
}

output "audit_bucket_name" {
  value = aws_s3_bucket.audit.id
}

output "assets_bucket_name" {
  value = aws_s3_bucket.assets.id
}
